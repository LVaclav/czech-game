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
  verbs?: Record<
    string,
    {
      firstCompletedAt?: string;
      lastTableCompletedAt?: string;
      flashcards?: {
        lastReviewedAt?: string | null;
      };
    }
  >;
}

function getCalendarDayDiff(earlierDateKey: string, laterDateKey: string): number {
  const cleanEarlier = earlierDateKey.slice(0, 10);
  const cleanLater = laterDateKey.slice(0, 10);
  const t1 = new Date(`${cleanEarlier}T00:00:00Z`).getTime();
  const t2 = new Date(`${cleanLater}T00:00:00Z`).getTime();
  if (Number.isNaN(t1) || Number.isNaN(t2)) return Infinity;
  return Math.round((t2 - t1) / (1000 * 60 * 60 * 24));
}

function isDateActiveForStreak(
  dateKey: string | null | undefined,
  localDateKey: string,
  utcDateKey: string
): boolean {
  if (!dateKey) return false;
  const clean = dateKey.slice(0, 10);
  const diffLocal = getCalendarDayDiff(clean, localDateKey);
  const diffUtc = getCalendarDayDiff(clean, utcDateKey);
  return (diffLocal >= -1 && diffLocal <= 1) || (diffUtc >= -1 && diffUtc <= 1);
}

function getActiveStreak(
  progress: StoredProgressSummary | null,
  localDateKey: string,
  utcDateKey: string
): number {
  if (!progress || !progress.stats) return 0;

  const storedActiveStreak = isDateActiveForStreak(
    progress.stats.lastActiveDate,
    localDateKey,
    utcDateKey
  )
    ? progress.stats.currentStreak || 0
    : 0;

  const activityMap: Record<string, number> = {
    ...(progress.stats.activityByDate || {}),
  };

  if (progress.stats.lastActiveDate) {
    const d = progress.stats.lastActiveDate.slice(0, 10);
    activityMap[d] = Math.max(
      activityMap[d] || 0,
      progress.stats.tablesCompletedToday || 1
    );
  }

  for (const rec of Object.values(progress.verbs || {})) {
    if (rec?.firstCompletedAt) {
      const d = rec.firstCompletedAt.slice(0, 10);
      activityMap[d] = Math.max(activityMap[d] || 0, 1);
    }
    if (rec?.lastTableCompletedAt) {
      const d = rec.lastTableCompletedAt.slice(0, 10);
      activityMap[d] = Math.max(activityMap[d] || 0, 1);
    }
    if (rec?.flashcards?.lastReviewedAt) {
      const d = rec.flashcards.lastReviewedAt.slice(0, 10);
      activityMap[d] = Math.max(activityMap[d] || 0, 1);
    }
  }

  const dates = Object.keys(activityMap)
    .filter((d) => activityMap[d] > 0)
    .sort();

  let activeRunFromDates = 0;
  if (dates.length > 0) {
    const mostRecentDate = dates[dates.length - 1];
    if (isDateActiveForStreak(mostRecentDate, localDateKey, utcDateKey)) {
      activeRunFromDates = 1;
      for (let i = dates.length - 1; i > 0; i--) {
        const diff = getCalendarDayDiff(dates[i - 1], dates[i]);
        if (diff === 1) {
          activeRunFromDates += 1;
        } else if (diff > 1) {
          break;
        }
      }
    }
  }

  return Math.max(storedActiveStreak, activeRunFromDates);
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

        const activeStreak = getActiveStreak(progress, localDateKey, utcDateKey);
        const payload: PushNotificationPayload = {
          title:
            activeStreak > 0
              ? `🔥 Keep your ${activeStreak}-day Czech streak alive!`
              : '🇨🇿 Start a new Czech streak today!',
          body:
            activeStreak > 0
              ? "It's 7:00 PM and you haven't practiced yet today. Complete a quick verb table to save your streak!"
              : "It's 7:00 PM and you have no active streak. Complete a quick 3×2 verb table today to start a new streak!",
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
