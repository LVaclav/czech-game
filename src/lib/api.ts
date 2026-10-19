import { AuthUserSession, UserProgressBlob } from '../types';

const SESSION_STORAGE_KEY = 'czech_trainer_auth_session_v1';
const LOCAL_USERS_DB_KEY = 'czech_trainer_local_users_v1';

function getProgressStorageKey(username: string): string {
  return `czech_trainer_progress_v1:${username.toLowerCase()}`;
}

export function createInitialProgress(username: string): UserProgressBlob {
  return {
    version: 1,
    username: username.toLowerCase(),
    updatedAt: new Date().toISOString(),
    stats: {
      currentStreak: 0,
      lastActiveDate: null,
      tablesCompletedToday: 0,
      tablesTotal: 0,
      totalTablesCompleted: 0,
      activeSession: null,
    } as UserProgressBlob['stats'],
    verbs: {},
  };
}

export function getSavedSession(): AuthUserSession | null {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AuthUserSession;
    if (parsed && parsed.username && parsed.token) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export function saveSession(session: AuthUserSession): void {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_STORAGE_KEY);
}

/**
 * Local fallback auth store for offline / local `vite` dev when Netlify Functions aren't running.
 */
interface LocalUserRecord {
  username: string;
  displayName: string;
  password: string;
}

function getLocalUsers(): Record<string, LocalUserRecord> {
  try {
    const raw = localStorage.getItem(LOCAL_USERS_DB_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveLocalUsers(users: Record<string, LocalUserRecord>): void {
  localStorage.setItem(LOCAL_USERS_DB_KEY, JSON.stringify(users));
}

export async function authenticateUser(
  mode: 'login' | 'register',
  rawUsername: string,
  password: string
): Promise<AuthUserSession> {
  const displayName = rawUsername.trim();
  const username = displayName.toLowerCase();

  if (!/^[a-z0-9_.-]{2,24}$/i.test(displayName)) {
    throw new Error('Username must be 2–24 characters (letters, numbers, _, ., -).');
  }
  if (password.length < 4) {
    throw new Error('Password must be at least 4 characters.');
  }

  try {
    const response = await fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: mode, username: displayName, password }),
    });

    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Authentication failed.');
      }
      const session: AuthUserSession = {
        username: data.username,
        displayName: data.displayName || displayName,
        token: data.token,
      };
      saveSession(session);
      return session;
    }
  } catch (err) {
    if (err instanceof Error && !err.message.includes('Failed to fetch') && !err.message.includes('NetworkError')) {
      throw err;
    }
    // Fall through to local auth fallback if running pure `vite` dev server or offline
  }

  // Offline / Local Dev Fallback
  const users = getLocalUsers();
  const existing = users[username];

  if (mode === 'register') {
    if (existing) {
      throw new Error(`Username "${username}" is already taken.`);
    }
    users[username] = { username, displayName, password };
    saveLocalUsers(users);
  } else {
    if (!existing || existing.password !== password) {
      throw new Error('Invalid username or password.');
    }
  }

  const session: AuthUserSession = {
    username,
    displayName: existing?.displayName || displayName,
    token: `local-dev-token:${username}`,
  };
  saveSession(session);
  return session;
}

export function loadLocalProgress(username: string): UserProgressBlob {
  try {
    const raw = localStorage.getItem(getProgressStorageKey(username));
    if (!raw) return createInitialProgress(username);
    const parsed = JSON.parse(raw) as UserProgressBlob;
    if (parsed && parsed.version === 1 && parsed.verbs) {
      return parsed;
    }
    return createInitialProgress(username);
  } catch {
    return createInitialProgress(username);
  }
}

export function saveLocalProgress(progress: UserProgressBlob): void {
  try {
    localStorage.setItem(
      getProgressStorageKey(progress.username),
      JSON.stringify(progress)
    );
  } catch {
    // Ignore storage quota errors
  }
}

/**
 * Loads the user's progress from Netlify Blobs (`progress:<username>`),
 * merging safely with any newer local offline state.
 */
export async function fetchUserProgress(
  session: AuthUserSession
): Promise<{ progress: UserProgressBlob; syncedWithCloud: boolean }> {
  const local = loadLocalProgress(session.username);

  if (session.token.startsWith('local-dev-token:')) {
    return { progress: local, syncedWithCloud: false };
  }

  try {
    const res = await fetch('/api/progress', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${session.token}`,
      },
    });

    const contentType = res.headers.get('content-type') || '';
    if (!res.ok || !contentType.includes('application/json')) {
      return { progress: local, syncedWithCloud: false };
    }

    const remote = (await res.json()) as UserProgressBlob | null;
    if (!remote || !remote.verbs) {
      return { progress: local, syncedWithCloud: true };
    }

    // Choose whichever has more completed tables or newer timestamp
    const localCount = local.stats.totalTablesCompleted || 0;
    const remoteCount = remote.stats.totalTablesCompleted || 0;

    if (
      remoteCount > localCount ||
      (remoteCount === localCount && remote.updatedAt >= local.updatedAt)
    ) {
      saveLocalProgress(remote);
      return { progress: remote, syncedWithCloud: true };
    } else {
      // Push newer local state up to cloud
      await syncUserProgress(session, local);
      return { progress: local, syncedWithCloud: true };
    }
  } catch {
    return { progress: local, syncedWithCloud: false };
  }
}

/**
 * Saves progress immediately to local storage and syncs asynchronously to Netlify Blobs.
 */
export async function syncUserProgress(
  session: AuthUserSession,
  progress: UserProgressBlob
): Promise<boolean> {
  saveLocalProgress(progress);

  if (session.token.startsWith('local-dev-token:')) {
    return false;
  }

  try {
    const res = await fetch('/api/progress', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.token}`,
      },
      body: JSON.stringify(progress),
    });
    return res.ok;
  } catch {
    return false;
  }
}
