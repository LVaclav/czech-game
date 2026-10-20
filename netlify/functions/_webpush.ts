import crypto from 'node:crypto';

/**
 * Default VAPID keypair (P-256) for Web Push (RFC 8292).
 * Can be overridden via environment variables VAPID_PUBLIC_KEY and VAPID_PRIVATE_JWK.
 */
export const DEFAULT_VAPID_PUBLIC_KEY =
  'BMWhW_aUQXyO7GRG0XBMWqn0ZgUD1AEQFktDQPXPgpbj5a0ngp_Fxr9g1e83Ot9_Xm6OMqFQHjhljHcPk-hpzYw';

const DEFAULT_VAPID_PRIVATE_JWK: crypto.JsonWebKey = {
  kty: 'EC',
  crv: 'P-256',
  x: 'xaFb9pRBfI7sZEbRcExaqfRmBQPUARAWS0NA9c-CluM',
  y: '5a0ngp_Fxr9g1e83Ot9_Xm6OMqFQHjhljHcPk-hpzYw',
  d: 'AQzYhwPmvTtNqjY-Eqpypzj-2xGukF6gwKIIp4vzXDk',
};

export interface PushSubscriptionRecord {
  endpoint: string;
  expirationTime?: number | null;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export interface UserNotificationSettingsBlob {
  username: string;
  displayName: string;
  timezone: string;
  reminderHour: number; // default 19 (7:00 PM local time)
  lastReminderDate: string | null; // YYYY-MM-DD in user's local timezone
  subscriptions: PushSubscriptionRecord[];
  updatedAt: string;
}

export interface PushNotificationPayload {
  title: string;
  body: string;
  tag?: string;
  url?: string;
  type?: 'streak-reminder' | 'nudge' | 'test';
  fromUsername?: string;
  fromDisplayName?: string;
  createdAt?: string;
}

export function getVapidPublicKey(): string {
  return process.env.VAPID_PUBLIC_KEY || DEFAULT_VAPID_PUBLIC_KEY;
}

function getVapidPrivateKey(): crypto.KeyObject {
  const envJwk = process.env.VAPID_PRIVATE_JWK;
  const jwk = envJwk ? (JSON.parse(envJwk) as crypto.JsonWebKey) : DEFAULT_VAPID_PRIVATE_JWK;
  return crypto.createPrivateKey({ key: jwk, format: 'jwk' });
}

function base64UrlEncode(input: Buffer | string): string {
  const buf = typeof input === 'string' ? Buffer.from(input, 'utf8') : input;
  return buf.toString('base64url');
}

function createVapidJwt(audience: string): string {
  const header = { typ: 'JWT', alg: 'ES256' };
  const nowSec = Math.floor(Date.now() / 1000);
  const payload = {
    aud: audience,
    exp: nowSec + 12 * 60 * 60,
    sub: 'mailto:notifications@czech-verb-trainer.app',
  };

  const signingInput = `${base64UrlEncode(JSON.stringify(header))}.${base64UrlEncode(
    JSON.stringify(payload)
  )}`;

  const signature = crypto.sign('sha256', Buffer.from(signingInput, 'utf8'), {
    key: getVapidPrivateKey(),
    dsaEncoding: 'ieee-p1363',
  });

  return `${signingInput}.${base64UrlEncode(signature)}`;
}

/**
 * Encrypts a UTF-8 string payload according to RFC 8291 (aes128gcm Web Push encryption).
 */
function encryptWebPushPayload(
  payloadText: string,
  uaPublicBase64Url: string,
  authSecretBase64Url: string
): Buffer {
  const uaPublic = Buffer.from(uaPublicBase64Url, 'base64url');
  const authSecret = Buffer.from(authSecretBase64Url, 'base64url');

  if (uaPublic.length !== 65) {
    throw new Error('Invalid client p256dh key length');
  }
  if (authSecret.length !== 16) {
    throw new Error('Invalid client auth secret length');
  }

  // Ephemeral application server ECDH keypair on P-256
  const ecdh = crypto.createECDH('prime256v1');
  ecdh.generateKeys();
  const asPublic = ecdh.getPublicKey(); // 65-byte uncompressed point
  const sharedSecret = ecdh.computeSecret(uaPublic);

  const salt = crypto.randomBytes(16);

  // RFC 8291 Section 3.3: Derive IKM from sharedSecret and authSecret
  const keyInfo = Buffer.concat([
    Buffer.from('WebPush: info\0', 'ascii'),
    uaPublic,
    asPublic,
  ]);
  const ikm = Buffer.from(
    crypto.hkdfSync('sha256', sharedSecret, authSecret, keyInfo, 32)
  );

  // Derive 16-byte Content Encryption Key (CEK) and 12-byte Nonce
  const cekInfo = Buffer.from('Content-Encoding: aes128gcm\0', 'ascii');
  const nonceInfo = Buffer.from('Content-Encoding: nonce\0', 'ascii');
  const cek = Buffer.from(crypto.hkdfSync('sha256', ikm, salt, cekInfo, 16));
  const nonce = Buffer.from(crypto.hkdfSync('sha256', ikm, salt, nonceInfo, 12));

  // Pad plaintext with 0x02 final record delimiter
  const paddedPlaintext = Buffer.concat([
    Buffer.from(payloadText, 'utf8'),
    Buffer.from([0x02]),
  ]);

  const cipher = crypto.createCipheriv('aes-128-gcm', cek, nonce);
  const ciphertext = Buffer.concat([
    cipher.update(paddedPlaintext),
    cipher.final(),
    cipher.getAuthTag(),
  ]);

  // RFC 8188 Section 2.1: aes128gcm binary header (salt[16] + rs[4] + idlen[1] + keyid[65])
  const recordSize = Buffer.alloc(4);
  recordSize.writeUInt32BE(4096, 0);
  const idLen = Buffer.from([asPublic.length]);

  return Buffer.concat([salt, recordSize, idLen, asPublic, ciphertext]);
}

export interface SendPushResult {
  endpoint: string;
  ok: boolean;
  status: number;
  expired: boolean;
}

/**
 * Sends an encrypted Web Push notification to a single PushSubscriptionRecord.
 * Works with Apple Push Notification service (web.push.apple.com on iPhone PWAs),
 * FCM (Chrome/Android), and Mozilla Autopush.
 */
export async function sendWebPushNotification(
  subscription: PushSubscriptionRecord,
  payload: PushNotificationPayload
): Promise<SendPushResult> {
  try {
    const endpointUrl = new URL(subscription.endpoint);
    const audience = `${endpointUrl.protocol}//${endpointUrl.host}`;
    const jwt = createVapidJwt(audience);
    const vapidPublicKey = getVapidPublicKey();

    const bodyBuffer = encryptWebPushPayload(
      JSON.stringify(payload),
      subscription.keys.p256dh,
      subscription.keys.auth
    );

    const response = await fetch(subscription.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Encoding': 'aes128gcm',
        'Content-Length': String(bodyBuffer.byteLength),
        TTL: '86400',
        Urgency: 'high',
        Authorization: `vapid t=${jwt}, k=${vapidPublicKey}`,
      },
      body: new Uint8Array(bodyBuffer),
    });

    const expired = response.status === 404 || response.status === 410;
    return {
      endpoint: subscription.endpoint,
      ok: response.ok,
      status: response.status,
      expired,
    };
  } catch (err) {
    console.error('Web Push delivery error:', err);
    return {
      endpoint: subscription.endpoint,
      ok: false,
      status: 0,
      expired: false,
    };
  }
}

/**
 * Helper to compute the current local YYYY-MM-DD and hour (0-23) in a given IANA timezone.
 */
export function getLocalDateAndHour(
  date: Date,
  timeZone: string
): { dateKey: string; hour: number } {
  let validTz = timeZone || 'Europe/Prague';
  try {
    Intl.DateTimeFormat('en-CA', { timeZone: validTz });
  } catch {
    validTz = 'Europe/Prague';
  }

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: validTz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const map: Record<string, string> = {};
  for (const p of parts) {
    map[p.type] = p.value;
  }

  const year = map.year || date.toISOString().slice(0, 4);
  const month = map.month || date.toISOString().slice(5, 7);
  const day = map.day || date.toISOString().slice(8, 10);
  const rawHour = parseInt(map.hour || '0', 10);
  const hour = rawHour === 24 ? 0 : rawHour;

  return {
    dateKey: `${year}-${month}-${day}`,
    hour,
  };
}
