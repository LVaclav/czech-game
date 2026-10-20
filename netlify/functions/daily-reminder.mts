import { getStore } from '@netlify/blobs';
import type { Config } from '@netlify/functions';
import {
  getLocalDateAndHour,
  PushNotificationPayload,
  sendWebPushNotification,
  UserNotificationSettingsBlob,
} from './_webpush';

const STORE_NAME = 'czech-trainer-store';

interface StoredProgressSummary {
  stats?: {
    currentStreak?: number;
    lastActiveDate?: string | null;
    tablesCompletedToday?: number;
    activityByDate?: Record<string, number>;
  };
}

function hasPracticedToday(
  progress: StoredProgressSummary | null,
  localDateKey: string,
  utcDateKey: string
): boolean {
  if (!progress || !progress.stats) return false;
  const { lastActiveDate, activityByDate, tablesCompletedToday } = progress.stats;

  if (lastActiveDate) {
    const activeDay = lastActiveDate.slice(0, 10);
    if (
      (activeDay === localDateKey || activeDay === utcDateKey) &&
      (tablesCompletedToday ?? 1) > 0
    ) {
      return true;
    }
  }

  if (activityByDate) {
    if ((activityByDate[localDateKey] || 0) > 0) return true;
    if ((activityByDate[utcDateKey] || 0) > 0) return true;
  }

  return false;
}

export default async (req: Request): Promise<Response> => {
  const store = getStore(STORE_NAME);
  const now = new Date();
  const utcDateKey = now.toISOString().slice(0, 10);
  const url = new URL(req.url);
  const forceCheck = url.searchParams.get('force') === '1';

  try {
    const pushList = await store.list({ prefix: 'push:' });
    let checkedUsers = 0;
    let remindersSent = 0;

    await Promise.all(
      pushList.blobs.map(async (blob) => {
        const settings = (await store.get(blob.key, {
          type: 'json',
        })) as UserNotificationSettingsBlob | null;

        if (!settings || !settings.subscriptions || settings.subscriptions.length === 0) {
          return;
        }

        checkedUsers += 1;
        const { dateKey: localDateKey, hour: localHour } = getLocalDateAndHour(
          now,
          settings.timezone || 'Europe/Prague'
        );

        const targetHour = settings.reminderHour ?? 19; // 7:00 PM local time
        if (!forceCheck && localHour !== targetHour) {
          return;
        }

        if (!forceCheck && settings.lastReminderDate === localDateKey) {
          return;
        }

        const progress = (await store.get(`progress:${settings.username}`, {
          type: 'json',
        })) as StoredProgressSummary | null;

        if (hasPracticedToday(progress, localDateKey, utcDateKey)) {
          return;
        }

        const currentStreak = progress?.stats?.currentStreak || 0;
        const payload: PushNotificationPayload = {
          title:
            currentStreak > 0
              ? `🔥 Keep your ${currentStreak}-day Czech streak alive!`
              : '🇨🇿 Time for your daily Czech verb!',
          body:
            currentStreak > 0
              ? "It's 7:00 PM and you haven't practiced yet today. Complete a quick verb table to save your streak!"
              : "It's 7:00 PM — practice a quick 3×2 verb table or flashcard set today!",
          tag: `daily-streak-reminder-${localDateKey}`,
          url: '/',
          type: 'streak-reminder',
          createdAt: now.toISOString(),
        };

        const results = await Promise.all(
          settings.subscriptions.map((sub) => sendWebPushNotification(sub, payload))
        );

        const validSubs = settings.subscriptions.filter(
          (_, idx) => !results[idx].expired
        );
        const anyDelivered = results.some((r) => r.ok);

        if (anyDelivered || validSubs.length !== settings.subscriptions.length) {
          if (anyDelivered) {
            remindersSent += 1;
          }
          await store.setJSON(blob.key, {
            ...settings,
            lastReminderDate: anyDelivered ? localDateKey : settings.lastReminderDate,
            subscriptions: validSubs,
            updatedAt: now.toISOString(),
          } satisfies UserNotificationSettingsBlob);
        }
      })
    );

    return Response.json({
      ok: true,
      checkedUsers,
      remindersSent,
      timestamp: now.toISOString(),
    });
  } catch (err) {
    console.error('Daily streak reminder error:', err);
    return Response.json(
      { error: 'Failed to run daily streak reminder check' },
      { status: 500 }
    );
  }
};

export const config: Config = {
  schedule: '0 * * * *',
};
