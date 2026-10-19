import crypto from 'node:crypto';

export interface StoredUserRecord {
  username: string;
  displayName: string;
  passwordHash: string;
  salt: string;
  createdAt: string;
}

const DEFAULT_SECRET = 'czech-verb-trainer-netlify-blobs-hmac-secret-v1';

function getSecret(): string {
  return process.env.AUTH_SECRET || process.env.NETLIFY_SITE_ID || DEFAULT_SECRET;
}

export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isValidUsername(raw: string): boolean {
  return /^[a-z0-9_.-]{2,24}$/i.test(raw.trim());
}

export function hashPassword(password: string, saltHex?: string): { hash: string; salt: string } {
  const salt = saltHex || crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return { hash: derived, salt };
}

export function verifyPassword(password: string, storedHashHex: string, saltHex: string): boolean {
  const { hash } = hashPassword(password, saltHex);
  const a = Buffer.from(hash, 'hex');
  const b = Buffer.from(storedHashHex, 'hex');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function createSessionToken(username: string): string {
  const cleanUser = normalizeUsername(username);
  const issuedAt = Date.now().toString(36);
  const payload = `${cleanUser}.${issuedAt}`;
  const sig = crypto
    .createHmac('sha256', getSecret())
    .update(payload)
    .digest('base64url');
  return `${payload}.${sig}`;
}

export function verifySessionToken(token: string | null | undefined): string | null {
  if (!token) return null;
  const raw = token.startsWith('Bearer ') ? token.slice(7).trim() : token.trim();
  const parts = raw.split('.');
  if (parts.length < 3) return null;

  const sig = parts.pop()!;
  const issuedAt = parts.pop()!;
  const username = parts.join('.');
  if (!username || !issuedAt || !sig) return null;

  const payload = `${username}.${issuedAt}`;
  const expectedSig = crypto
    .createHmac('sha256', getSecret())
    .update(payload)
    .digest('base64url');

  const a = Buffer.from(sig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return null;
  }

  return username;
}
