import { getStore } from '@netlify/blobs';
import type { Context } from '@netlify/functions';
import { verifySessionToken } from './_auth';

const STORE_NAME = 'czech-trainer-store';

export default async (req: Request, _context: Context): Promise<Response> => {
  const authHeader = req.headers.get('authorization');
  const username = verifySessionToken(authHeader);

  if (!username) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const progressKey = `progress:${username}`;
  const store = getStore(STORE_NAME);

  try {
    if (req.method === 'GET') {
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
