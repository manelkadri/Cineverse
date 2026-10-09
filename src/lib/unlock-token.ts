import { createHmac, timingSafeEqual } from 'node:crypto';

// Pure signing and verification of the "profile unlocked" cookie value (no framework imports, so it is unit-testable).
// The value is `<base64url claim>.<base64url HMAC>`; the HMAC key is derived from the app secret.
export const UNLOCK_MAX_AGE_SECONDS = 24 * 60 * 60;

export interface UnlockClaim { s: string; u: string; p: string; e: number }

const key = (secret: string) => createHmac('sha256', secret).update('cineverse-unlock-cookie').digest();
const mac = (secret: string, body: string) => createHmac('sha256', key(secret)).update(body).digest('base64url');

export function signUnlockToken(secret: string, claim: { sid: string; userId: string; profileId: string }, now = Date.now()) {
  const body = Buffer.from(JSON.stringify({ s: claim.sid, u: claim.userId, p: claim.profileId, e: now + UNLOCK_MAX_AGE_SECONDS * 1000 } satisfies UnlockClaim)).toString('base64url');
  return `${body}.${mac(secret, body)}`;
}

export function readUnlockToken(secret: string, value: string | undefined | null, now = Date.now()): UnlockClaim | null {
  if (!secret || !value) return null;
  const [body, signature, extra] = value.split('.');
  if (!body || !signature || extra !== undefined) return null;
  const expected = Buffer.from(mac(secret, body));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const claim = JSON.parse(Buffer.from(body, 'base64url').toString()) as UnlockClaim;
    if (typeof claim.s !== 'string' || typeof claim.u !== 'string' || typeof claim.p !== 'string' || typeof claim.e !== 'number' || claim.e < now) return null;
    return claim;
  } catch {
    return null;
  }
}
