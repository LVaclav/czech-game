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

export default async (req: Request, _context: Context): Promise<Response> => {
  const authHeader = req.headers.get('authorization');
  const username = verifySessionToken(authHeader);

  if (!username) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const progressKey = `progress:${username}`;
  const store = getStore(STORE_NAME);
  const url = new URL(req.url);

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
            const p = (await store.get(b.key, { type: 'json' })) as {
              username?: string;
              stats?: {
                currentStreak?: number;
                longestStreak?: number;
                totalTablesCompleted?: number;
                lastActiveDate?: string | null;
              };
              verbs?: Record<string, { completed?: boolean }>;
            } | null;

            if (!p) return;
            const uname = (p.username || b.key.replace(/^progress:/, '')).toLowerCase();
            const masteredCount = Object.values(p.verbs || {}).filter((v) =>
              Boolean(v?.completed)
            ).length;
            const currentStreak = p.stats?.currentStreak || 0;
            const longestStreak = Math.max(
              p.stats?.longestStreak || 0,
              currentStreak
            );
            const totalTablesCompleted = p.stats?.totalTablesCompleted || 0;

            rowsByUsername[uname] = {
              username: uname,
              displayName: displayNames[uname] || uname,
              currentStreak,
              longestStreak,
              masteredCount,
              totalTablesCompleted,
              lastActiveDate: p.stats?.lastActiveDate || null,
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

      const data = await store.get(progressKey, { type: 'json' });
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
