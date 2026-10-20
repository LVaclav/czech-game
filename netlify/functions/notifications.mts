import { getStore } from '@netlify/blobs';
import type { Context } from '@netlify/functions';
import { normalizeUsername, StoredUserRecord, verifySessionToken } from './_auth';
import {
  getVapidPublicKey,
  PushNotificationPayload,
  PushSubscriptionRecord,
  sendWebPushNotification,
  UserNotificationSettingsBlob,
} from './_webpush';

const STORE_NAME = 'czech-trainer-store';

export interface InboxNotificationItem extends PushNotificationPayload {
  id: string;
  createdAt: string;
}

interface UserInboxBlob {
  username: string;
  items: InboxNotificationItem[];
}

function isValidSubscription(sub: unknown): sub is PushSubscriptionRecord {
  if (!sub || typeof sub !== 'object') return false;
  const candidate = sub as Record<string, unknown>;
  if (typeof candidate.endpoint !== 'string' || !candidate.endpoint.startsWith('https://')) {
    return false;
  }
  const keys = candidate.keys as Record<string, unknown> | undefined;
  if (!keys || typeof keys !== 'object') return false;
  return typeof keys.p256dh === 'string' && typeof keys.auth === 'string';
}

export default async (req: Request, _context: Context): Promise<Response> => {
  const authHeader = req.headers.get('authorization');
  const username = verifySessionToken(authHeader);

  if (!username) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const store = getStore(STORE_NAME);
  const pushKey = `push:${username}`;
  const inboxKey = `inbox:${username}`;

  try {
    if (req.method === 'GET') {
      const [pushSettings, inboxBlob] = await Promise.all([
        store.get(pushKey, { type: 'json' }) as Promise<UserNotificationSettingsBlob | null>,
        store.get(inboxKey, { type: 'json' }) as Promise<UserInboxBlob | null>,
      ]);

      const pendingItems = inboxBlob?.items || [];
      if (pendingItems.length > 0) {
        await store.setJSON(inboxKey, {
          username,
          items: [],
        } satisfies UserInboxBlob);
      }

      return Response.json({
        vapidPublicKey: getVapidPublicKey(),
        subscribed: Boolean(pushSettings && pushSettings.subscriptions.length > 0),
        subscriptionCount: pushSettings?.subscriptions.length || 0,
        timezone: pushSettings?.timezone || 'Europe/Prague',
        pendingNotifications: pendingItems,
      });
    }

    if (req.method === 'POST') {
      const body = (await req.json()) as {
        action?: 'subscribe' | 'unsubscribe' | 'nudge' | 'test';
        subscription?: PushSubscriptionRecord;
        endpoint?: string;
        timezone?: string;
        targetUsername?: string;
      };

      const action = body?.action;

      if (action === 'subscribe') {
        const existing = (await store.get(pushKey, {
          type: 'json',
        })) as UserNotificationSettingsBlob | null;

        const userRec = (await store.get(`user:${username}`, {
          type: 'json',
        })) as StoredUserRecord | null;

        const subs: PushSubscriptionRecord[] = existing?.subscriptions
          ? [...existing.subscriptions]
          : [];

        if (isValidSubscription(body.subscription)) {
          const idx = subs.findIndex((s) => s.endpoint === body.subscription!.endpoint);
          if (idx >= 0) {
            subs[idx] = body.subscription;
          } else {
            subs.push(body.subscription);
          }
        }

        const updated: UserNotificationSettingsBlob = {
          username,
          displayName: userRec?.displayName || existing?.displayName || username,
          timezone: body.timezone || existing?.timezone || 'Europe/Prague',
          reminderHour: existing?.reminderHour ?? 19,
          lastReminderDate: existing?.lastReminderDate ?? null,
          subscriptions: subs.slice(-5), // keep up to 5 recent devices per user
          updatedAt: new Date().toISOString(),
        };

        await store.setJSON(pushKey, updated);
        return Response.json({
          ok: true,
          subscribed: updated.subscriptions.length > 0,
          subscriptionCount: updated.subscriptions.length,
        });
      }

      if (action === 'unsubscribe') {
        const existing = (await store.get(pushKey, {
          type: 'json',
        })) as UserNotificationSettingsBlob | null;

        if (existing) {
          const nextSubs = body.endpoint
            ? existing.subscriptions.filter((s) => s.endpoint !== body.endpoint)
            : [];
          await store.setJSON(pushKey, {
            ...existing,
            subscriptions: nextSubs,
            updatedAt: new Date().toISOString(),
          } satisfies UserNotificationSettingsBlob);
        }

        return Response.json({ ok: true, subscribed: false });
      }

      if (action === 'nudge') {
        const targetRaw = body.targetUsername || '';
        const targetUsername = normalizeUsername(targetRaw);

        if (!targetUsername || targetUsername === username) {
          return Response.json(
            { error: 'Invalid target player to nudge.' },
            { status: 400 }
          );
        }

        const [senderUser, targetPush, targetInbox] = await Promise.all([
          store.get(`user:${username}`, { type: 'json' }) as Promise<StoredUserRecord | null>,
          store.get(`push:${targetUsername}`, {
            type: 'json',
          }) as Promise<UserNotificationSettingsBlob | null>,
          store.get(`inbox:${targetUsername}`, {
            type: 'json',
          }) as Promise<UserInboxBlob | null>,
        ]);

        const senderDisplayName = senderUser?.displayName || username;
        const nowIso = new Date().toISOString();

        const payload: PushNotificationPayload = {
          title: `👋 Nudge from ${senderDisplayName}!`,
          body: `${senderDisplayName} says you keep conjugating!`,
          tag: `nudge-${username}-${Date.now()}`,
          url: '/',
          type: 'nudge',
          fromUsername: username,
          fromDisplayName: senderDisplayName,
          createdAt: nowIso,
        };

        let deliveredPushCount = 0;
        if (targetPush && targetPush.subscriptions.length > 0) {
          const results = await Promise.all(
            targetPush.subscriptions.map((sub) =>
              sendWebPushNotification(sub, payload)
            )
          );

          const validSubs = targetPush.subscriptions.filter(
            (_, idx) => !results[idx].expired
          );
          deliveredPushCount = results.filter((r) => r.ok).length;

          if (validSubs.length !== targetPush.subscriptions.length) {
            await store.setJSON(`push:${targetUsername}`, {
              ...targetPush,
              subscriptions: validSubs,
              updatedAt: nowIso,
            } satisfies UserNotificationSettingsBlob);
          }
        }

        // Only queue to inbox if no direct Web Push was delivered so the recipient doesn't see it twice,
        // or keep a lightweight inbox entry if they have no push subscriptions registered.
        if (deliveredPushCount === 0) {
          const existingItems = targetInbox?.items || [];
          const newItem: InboxNotificationItem = {
            ...payload,
            id: `${username}-${Date.now()}`,
            createdAt: nowIso,
          };
          await store.setJSON(`inbox:${targetUsername}`, {
            username: targetUsername,
            items: [...existingItems.slice(-9), newItem],
          } satisfies UserInboxBlob);
        }

        return Response.json({
          ok: true,
          deliveredPushCount,
          queuedInInbox: deliveredPushCount === 0,
          message: `Nudged ${targetPush?.displayName || targetRaw}!`,
        });
      }

      if (action === 'test') {
        const [senderUser, userPush] = await Promise.all([
          store.get(`user:${username}`, { type: 'json' }) as Promise<StoredUserRecord | null>,
          store.get(pushKey, {
            type: 'json',
          }) as Promise<UserNotificationSettingsBlob | null>,
        ]);

        const displayName = senderUser?.displayName || username;
        const payload: PushNotificationPayload = {
          title: 'Čeština Notifications Active 🔔',
          body: `${displayName} says you keep conjugating! Your 7:00 PM streak reminder is ready.`,
          tag: 'czech-trainer-test',
          url: '/',
          type: 'test',
          createdAt: new Date().toISOString(),
        };

        let deliveredPushCount = 0;
        if (userPush && userPush.subscriptions.length > 0) {
          const results = await Promise.all(
            userPush.subscriptions.map((sub) =>
              sendWebPushNotification(sub, payload)
            )
          );
          deliveredPushCount = results.filter((r) => r.ok).length;
        }

        return Response.json({
          ok: true,
          deliveredPushCount,
        });
      }

      return Response.json({ error: 'Unknown notification action' }, { status: 400 });
    }

    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  } catch (err) {
    console.error('Notifications function error:', err);
    return Response.json(
      { error: 'Failed to process notification request' },
      { status: 500 }
    );
  }
};
