import { AuthUserSession, UserProgressBlob } from '../types';
import { getEffectiveActivityMap } from './priorityQueue';

export const DEFAULT_VAPID_PUBLIC_KEY =
  (import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined) ||
  'BKO_71z0XLOA6laYShvI8nmnerXc-onwpZvMngq0wF5lmNAay4fyfmMC6X7D5nxctXoPnLofY_ZA8In_acmTyFM';

const PROMPT_DISMISSED_SESSION_KEY = 'czech_trainer_notif_prompt_dismissed_session_v1';
const LOCAL_INBOX_STORAGE_PREFIX = 'czech_trainer_local_inbox_v1:';
const LOCAL_REMINDER_SHOWN_PREFIX = 'czech_trainer_daily_reminder_shown_v1:';

export type NotificationPermissionState =
  | 'granted'
  | 'denied'
  | 'default'
  | 'unsupported';

export interface AppNotificationItem {
  id: string;
  title: string;
  body: string;
  tag?: string;
  type?: 'streak-reminder' | 'nudge' | 'test';
  fromUsername?: string;
  fromDisplayName?: string;
  createdAt: string;
}

export function getNotificationPermissionState(): NotificationPermissionState {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'unsupported';
  }
  return Notification.permission as NotificationPermissionState;
}

export function isNotificationPromptDismissedThisSession(): boolean {
  try {
    return sessionStorage.getItem(PROMPT_DISMISSED_SESSION_KEY) === '1';
  } catch {
    return false;
  }
}

export function dismissNotificationPromptForSession(): void {
  try {
    sessionStorage.setItem(PROMPT_DISMISSED_SESSION_KEY, '1');
  } catch {
    // Ignore storage errors
  }
}

export function getUserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Prague';
  } catch {
    return 'Europe/Prague';
  }
}

export function getLocalTodayDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

async function getServiceWorkerRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }
  try {
    const existing = await navigator.serviceWorker.getRegistration('/');
    if (existing) return existing;
    return await navigator.serviceWorker.register('/sw.js', {
      updateViaCache: 'none',
    });
  } catch {
    return null;
  }
}

/**
 * Displays a native notification via the active Service Worker (required on iOS & Android PWAs)
 * with a fallback to `new Notification()` on desktop browsers.
 */
export async function showNativeNotification(
  title: string,
  options: {
    body: string;
    tag?: string;
    url?: string;
  }
): Promise<boolean> {
  if (getNotificationPermissionState() !== 'granted') {
    return false;
  }

  try {
    const reg = await getServiceWorkerRegistration();
    if (reg && 'showNotification' in reg) {
      await reg.showNotification(title, {
        body: options.body,
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        tag: options.tag || `notif-${Date.now()}`,
        data: { url: options.url || '/' },
      });
      return true;
    }
  } catch {
    // Fallback to standard Notification constructor below
  }

  try {
    new Notification(title, {
      body: options.body,
      icon: '/icon-192.png',
      tag: options.tag,
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Ensures the browser's PushManager is subscribed with our VAPID public key
 * and syncs the PushSubscription + user's local timezone to Netlify Blobs.
 */
export async function syncPushSubscriptionWithServer(
  session: AuthUserSession,
  vapidPublicKey: string = DEFAULT_VAPID_PUBLIC_KEY
): Promise<boolean> {
  if (getNotificationPermissionState() !== 'granted') {
    return false;
  }

  let subscriptionJson: PushSubscriptionJSON | undefined;

  try {
    const reg = await getServiceWorkerRegistration();
    if (reg && 'pushManager' in reg) {
      const appServerKey = urlBase64ToUint8Array(vapidPublicKey);
      let sub = await reg.pushManager.getSubscription();

      if (sub && sub.options?.applicationServerKey) {
        const existingKey = new Uint8Array(sub.options.applicationServerKey);
        const matches =
          existingKey.length === appServerKey.length &&
          existingKey.every((b, idx) => b === appServerKey[idx]);
        if (!matches) {
          await sub.unsubscribe().catch(() => {});
          sub = null;
        }
      }

      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: appServerKey as unknown as BufferSource,
        });
      }
      subscriptionJson = sub.toJSON();
    }
  } catch {
    // PushManager may be unavailable in non-HTTPS local dev; still sync timezone
  }

  if (session.token.startsWith('local-dev-token:')) {
    return Boolean(subscriptionJson);
  }

  try {
    const res = await fetch('/api/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.token}`,
      },
      body: JSON.stringify({
        action: 'subscribe',
        subscription: subscriptionJson,
        timezone: getUserTimezone(),
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Requests native notification permission directly inside a user tap handler (required by iOS WebKit)
 * and subscribes the device to Web Push notifications.
 */
export async function requestAndSubscribeNotifications(
  session: AuthUserSession
): Promise<{ permission: NotificationPermissionState; subscribed: boolean }> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return { permission: 'unsupported', subscribed: false };
  }

  // Must invoke Notification.requestPermission() immediately in the user tap gesture
  const result = await Notification.requestPermission();
  const permission = result as NotificationPermissionState;

  if (permission !== 'granted') {
    return { permission, subscribed: false };
  }

  const subscribed = await syncPushSubscriptionWithServer(session);
  return { permission, subscribed };
}

function popLocalInboxNotifications(username: string): AppNotificationItem[] {
  const key = `${LOCAL_INBOX_STORAGE_PREFIX}${username.toLowerCase()}`;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    localStorage.removeItem(key);
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function pushLocalInboxNotification(
  targetUsername: string,
  item: AppNotificationItem
): void {
  const key = `${LOCAL_INBOX_STORAGE_PREFIX}${targetUsername.toLowerCase()}`;
  try {
    const raw = localStorage.getItem(key);
    const existing: AppNotificationItem[] = raw ? JSON.parse(raw) : [];
    const next = [...(Array.isArray(existing) ? existing.slice(-9) : []), item];
    localStorage.setItem(key, JSON.stringify(next));
  } catch {
    // Ignore storage errors
  }
}

/**
 * Syncs the current user's push subscription and checks for any pending nudges in their inbox.
 */
export async function checkPendingNotifications(
  session: AuthUserSession
): Promise<AppNotificationItem[]> {
  const collected: AppNotificationItem[] = [
    ...popLocalInboxNotifications(session.username),
  ];

  if (!session.token.startsWith('local-dev-token:')) {
    try {
      const res = await fetch('/api/notifications', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${session.token}`,
        },
      });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = (await res.json()) as {
          vapidPublicKey?: string;
          pendingNotifications?: AppNotificationItem[];
        };

        if (getNotificationPermissionState() === 'granted') {
          await syncPushSubscriptionWithServer(
            session,
            data.vapidPublicKey || DEFAULT_VAPID_PUBLIC_KEY
          );
        }

        if (Array.isArray(data.pendingNotifications)) {
          collected.push(...data.pendingNotifications);
        }
      }
    } catch {
      // Ignore offline errors
    }
  }

  // Trigger native notifications for any pending inbox items
  for (const item of collected) {
    await showNativeNotification(item.title, {
      body: item.body,
      tag: item.tag || `inbox-${item.id}`,
      url: '/',
    });
  }

  return collected;
}

/**
 * Sends a Leaderboard Nudge to another player:
 * "'<senderDisplayName>' says you keep conjugating!"
 */
export async function sendLeaderboardNudge(
  session: AuthUserSession,
  targetUsername: string,
  targetDisplayName: string
): Promise<{ ok: boolean; message: string }> {
  const cleanTarget = targetUsername.trim().toLowerCase();
  const title = `👋 Nudge from ${session.displayName}!`;
  const body = `${session.displayName} says you keep conjugating!`;

  if (!session.token.startsWith('local-dev-token:')) {
    try {
      const res = await fetch('/api/notifications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.token}`,
        },
        body: JSON.stringify({
          action: 'nudge',
          targetUsername: cleanTarget,
        }),
      });

      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        return {
          ok: true,
          message: data.message || `Nudged ${targetDisplayName}!`,
        };
      }
    } catch {
      // Fall through to local fallback
    }
  }

  // Local fallback (for local Vite dev or offline multi-user accounts on the same device)
  pushLocalInboxNotification(cleanTarget, {
    id: `${session.username}-${Date.now()}`,
    title,
    body,
    tag: `nudge-${session.username}-${Date.now()}`,
    type: 'nudge',
    fromUsername: session.username,
    fromDisplayName: session.displayName,
    createdAt: new Date().toISOString(),
  });

  return {
    ok: true,
    message: `Nudged ${targetDisplayName}!`,
  };
}

/**
 * Sends a test notification so the user can immediately verify native notifications on iPhone.
 */
export async function sendTestNotification(
  session: AuthUserSession
): Promise<boolean> {
  if (getNotificationPermissionState() !== 'granted') {
    const { permission } = await requestAndSubscribeNotifications(session);
    if (permission !== 'granted') return false;
  }

  if (!session.token.startsWith('local-dev-token:')) {
    try {
      const res = await fetch('/api/notifications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.token}`,
        },
        body: JSON.stringify({ action: 'test' }),
      });
      if (res.ok) {
        const data = (await res.json()) as { deliveredPushCount?: number };
        if ((data.deliveredPushCount || 0) > 0) {
          return true;
        }
      }
    } catch {
      // Fallback to local service worker notification
    }
  }

  return showNativeNotification('Čeština Notifications Active 🔔', {
    body: `${session.displayName} says you keep conjugating! Your 7:00 PM streak reminder is ready.`,
    tag: 'czech-trainer-test',
    url: '/',
  });
}

/**
 * Checks whether the user has practiced today, and if the local time is in the 7:00 PM window
 * (19:00–22:59) without having practiced today, fires the daily reminder once per day.
 * (This complements the server-side Netlify Scheduled Function that pushes at 19:00 when closed.)
 */
export async function checkLocalDailyStreakReminder(
  progress: UserProgressBlob
): Promise<boolean> {
  if (getNotificationPermissionState() !== 'granted') {
    return false;
  }

  const now = new Date();
  const hour = now.getHours();
  if (hour < 19) {
    return false;
  }

  const localToday = getLocalTodayDateString();
  const utcToday = now.toISOString().slice(0, 10);
  const activityMap = getEffectiveActivityMap(progress);

  const practicedToday =
    (activityMap[localToday] || 0) > 0 || (activityMap[utcToday] || 0) > 0;
  if (practicedToday) {
    return false;
  }

  const shownKey = `${LOCAL_REMINDER_SHOWN_PREFIX}${progress.username}:${localToday}`;
  try {
    if (localStorage.getItem(shownKey) === '1') {
      return false;
    }
    localStorage.setItem(shownKey, '1');
  } catch {
    // Ignore storage errors
  }

  const currentStreak = progress.stats.currentStreak || 0;
  const title =
    currentStreak > 0
      ? `🔥 Keep your ${currentStreak}-day Czech streak alive!`
      : '🇨🇿 Time for your daily Czech verb!';
  const body =
    currentStreak > 0
      ? "It's past 7:00 PM and you haven't practiced yet today. Complete a quick verb table to save your streak!"
      : "It's 7:00 PM — practice a quick 3×2 verb table or flashcard set today!";

  return showNativeNotification(title, {
    body,
    tag: `daily-streak-reminder-${localToday}`,
    url: '/',
  });
}
