import { getStore } from '@netlify/blobs';
import type { Context } from '@netlify/functions';
import { StoredUserRecord, verifySessionToken } from './_auth';

const STORE_NAME = 'czech-trainer-store';

interface LeaderboardRow {
  username: string;
  displayName: string;
  currentStreak: number;
  longestStreak: number;
  masteredCount: number;
  totalTablesCompleted: number;
  lastActiveDate: string | null;
}

interface StoredProgressBlob {
  username?: string;
  stats?: {
    currentStreak?: number;
    longestStreak?: number;
    totalTablesCompleted?: number;
    tablesCompletedToday?: number;
    lastActiveDate?: string | null;
    activityByDate?: Record<string, number>;
  };
  verbs?: Record<
    string,
    {
      completed?: boolean;
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
  utcToday: string
): boolean {
  if (!dateKey) return false;
  const diff = getCalendarDayDiff(dateKey.slice(0, 10), utcToday);
  return diff >= -1 && diff <= 1;
}

function computeProgressStreaks(
  p: StoredProgressBlob,
  utcToday: string
): { activeStreak: number; longestStreak: number; latestActiveDate: string | null } {
  const activityMap: Record<string, number> = {
    ...(p.stats?.activityByDate || {}),
  };

  if (p.stats?.lastActiveDate) {
    const d = p.stats.lastActiveDate.slice(0, 10);
    activityMap[d] = Math.max(activityMap[d] || 0, p.stats.tablesCompletedToday || 1);
  }

  for (const rec of Object.values(p.verbs || {})) {
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

  let bestFromDates = 0;
  let currentRun = 0;
  for (let i = 0; i < dates.length; i++) {
    if (i > 0) {
      const diff = getCalendarDayDiff(dates[i - 1], dates[i]);
      if (diff === 1) {
        currentRun += 1;
      } else if (diff > 1) {
        currentRun = 1;
      }
    } else {
      currentRun = 1;
    }
    if (currentRun > bestFromDates) {
      bestFromDates = currentRun;
    }
  }

  const storedStreak = p.stats?.currentStreak || 0;
  const lastActiveDate = p.stats?.lastActiveDate || (dates.length > 0 ? dates[dates.length - 1] : null);
  const storedActiveStreak = isDateActiveForStreak(p.stats?.lastActiveDate, utcToday)
    ? storedStreak
    : 0;

  let activeRunFromDates = 0;
  if (dates.length > 0) {
    const mostRecentDate = dates[dates.length - 1];
    if (isDateActiveForStreak(mostRecentDate, utcToday)) {
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

  const activeStreak = Math.max(storedActiveStreak, activeRunFromDates);
  const longestStreak = Math.max(
    p.stats?.longestStreak || 0,
    storedStreak,
    bestFromDates,
    activeStreak
  );

  return {
    activeStreak,
    longestStreak,
    latestActiveDate: lastActiveDate,
  };
}

export default async (req: Request, _context: Context): Promise<Response> => {
  const authHeader = req.headers.get('authorization');
  const username = verifySessionToken(authHeader);

  if (!username) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const progressKey = `progress:${username}`;
  const store = getStore(STORE_NAME);
  const url = new URL(req.url);
  const utcToday = new Date().toISOString().slice(0, 10);

  try {
    if (req.method === 'GET') {
      // Multi-user leaderboard query: GET /api/progress?leaderboard=1
      if (url.searchParams.get('leaderboard') === '1') {
        const [usersList, progressList] = await Promise.all([
          store.list({ prefix: 'user:' }),
          store.list({ prefix: 'progress:' }),
        ]);

        const displayNames: Record<string, string> = {};
        await Promise.all(
          usersList.blobs.map(async (b) => {
            const u = (await store.get(b.key, {
              type: 'json',
            })) as StoredUserRecord | null;
            if (u && u.username) {
              displayNames[u.username.toLowerCase()] = u.displayName || u.username;
            }
          })
        );

        const rowsByUsername: Record<string, LeaderboardRow> = {};

        for (const uname of Object.keys(displayNames)) {
          rowsByUsername[uname] = {
            username: uname,
            displayName: displayNames[uname],
            currentStreak: 0,
            longestStreak: 0,
            masteredCount: 0,
            totalTablesCompleted: 0,
            lastActiveDate: null,
          };
        }

        await Promise.all(
          progressList.blobs.map(async (b) => {
            const p = (await store.get(b.key, {
              type: 'json',
            })) as StoredProgressBlob | null;

            if (!p) return;
            const uname = (p.username || b.key.replace(/^progress:/, '')).toLowerCase();
            const masteredCount = Object.values(p.verbs || {}).filter((v) =>
              Boolean(v?.completed)
            ).length;
            const { activeStreak, longestStreak, latestActiveDate } =
              computeProgressStreaks(p, utcToday);
            const totalTablesCompleted = p.stats?.totalTablesCompleted || 0;

            rowsByUsername[uname] = {
              username: uname,
              displayName: displayNames[uname] || uname,
              currentStreak: activeStreak,
              longestStreak,
              masteredCount,
              totalTablesCompleted,
              lastActiveDate: latestActiveDate,
            };
          })
        );

        const leaderboard = Object.values(rowsByUsername).sort((a, b) => {
          if (b.masteredCount !== a.masteredCount) {
            return b.masteredCount - a.masteredCount;
          }
          if (b.currentStreak !== a.currentStreak) {
            return b.currentStreak - a.currentStreak;
          }
          return b.totalTablesCompleted - a.totalTablesCompleted;
        });

        return Response.json({ leaderboard });
      }

      const data = (await store.get(progressKey, {
        type: 'json',
      })) as StoredProgressBlob | null;
      if (data && data.stats) {
        const { activeStreak, longestStreak } = computeProgressStreaks(
          data,
          utcToday
        );
        const isActiveToday =
          data.stats.lastActiveDate?.slice(0, 10) === utcToday;
        return Response.json({
          ...data,
          stats: {
            ...data.stats,
            currentStreak: activeStreak,
            longestStreak,
            tablesCompletedToday: isActiveToday
              ? data.stats.tablesCompletedToday || 0
              : 0,
          },
        });
      }
      return Response.json(data || null);
    }

    if (req.method === 'POST') {
      const payload = await req.json();
      if (!payload || typeof payload !== 'object') {
        return Response.json({ error: 'Invalid progress payload' }, { status: 400 });
      }

      const sanitized = {
        ...payload,
        version: 1,
        username,
        updatedAt: new Date().toISOString(),
      };

      await store.setJSON(progressKey, sanitized);
      return Response.json({ ok: true, updatedAt: sanitized.updatedAt });
    }

    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  } catch (err) {
    console.error('Progress blob error:', err);
    return Response.json({ error: 'Failed to access Netlify Blobs' }, { status: 500 });
  }
};
