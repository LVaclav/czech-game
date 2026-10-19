import { getStore } from '@netlify/blobs';
import type { Context } from '@netlify/functions';
import {
  createSessionToken,
  hashPassword,
  isValidUsername,
  normalizeUsername,
  StoredUserRecord,
  verifyPassword,
} from './_auth';

const STORE_NAME = 'czech-trainer-store';

export default async (req: Request, _context: Context): Promise<Response> => {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const body = (await req.json()) as {
      action?: 'login' | 'register';
      username?: string;
      password?: string;
    };

    const action = body.action;
    const rawUsername = (body.username || '').trim();
    const password = body.password || '';

    if (!isValidUsername(rawUsername)) {
      return Response.json(
        { error: 'Username must be 2–24 characters (letters, numbers, _, ., -).' },
        { status: 400 }
      );
    }

    if (password.length < 4) {
      return Response.json(
        { error: 'Password must be at least 4 characters.' },
        { status: 400 }
      );
    }

    const username = normalizeUsername(rawUsername);
    const userKey = `user:${username}`;
    const store = getStore(STORE_NAME);

    const existingUser = (await store.get(userKey, {
      type: 'json',
    })) as StoredUserRecord | null;

    if (action === 'register') {
      if (existingUser) {
        return Response.json(
          { error: `Username "${rawUsername}" is already taken.` },
          { status: 409 }
        );
      }

      const { hash, salt } = hashPassword(password);
      const newUser: StoredUserRecord = {
        username,
        displayName: rawUsername,
        passwordHash: hash,
        salt,
        createdAt: new Date().toISOString(),
      };

      await store.setJSON(userKey, newUser);
      const token = createSessionToken(username);

      return Response.json({
        username,
        displayName: rawUsername,
        token,
      });
    }

    if (action === 'login') {
      if (!existingUser) {
        return Response.json(
          { error: 'Account not found. Switch to "Create Account" to register.' },
          { status: 401 }
        );
      }

      const valid = verifyPassword(password, existingUser.passwordHash, existingUser.salt);
      if (!valid) {
        return Response.json(
          { error: 'Invalid username or password.' },
          { status: 401 }
        );
      }

      const token = createSessionToken(username);
      return Response.json({
        username: existingUser.username,
        displayName: existingUser.displayName || existingUser.username,
        token,
      });
    }

    return Response.json({ error: 'Invalid auth action.' }, { status: 400 });
  } catch (err) {
    console.error('Auth error:', err);
    return Response.json(
      { error: 'Authentication service unavailable.' },
      { status: 500 }
    );
  }
};
