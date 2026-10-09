import 'server-only';
import { createHmac } from 'node:crypto';
import { hashPinWithPepper, verifyPinWithPeppers } from './pin-hash';
import { prisma } from './prisma';
import { authSecret, AuthRateLimitError, type AuthIdentity } from './auth-security';

// A 4-digit PIN has only 10,000 possibilities, so the hash alone cannot protect it: an attacker holding a copy of
// the database could try every value in seconds. Two defences:
//  1. The PIN is first run through HMAC-SHA256 keyed with a server-side secret (PIN_PEPPER, or AUTH_SECRET when it is
//     not set) and bound to the profile id, then hashed with bcrypt (cost 12). Without the server secret, a leaked
//     database cannot be brute-forced offline. (Changing that secret means every PIN must be set again.)
//  2. Online guessing is capped by persistent attempt limits with temporary lockouts (see below).
//
// Introducing PIN_PEPPER after PINs were created with the AUTH_SECRET fallback must not lock anyone out. New hashes
// always use the primary pepper (PIN_PEPPER, else AUTH_SECRET). Verification also accepts, in this order, hashes made
// with the legacy AUTH_SECRET and with PIN_PEPPER_PREVIOUS (for a later pepper rotation). Because only a correct PIN
// proves the plaintext, an old-pepper hash is upgraded to the primary pepper right after a successful unlock.
// PIN_LEGACY_FALLBACK=off removes the AUTH_SECRET fallback once every PIN has been upgraded.
const primaryPepper = () => process.env.PIN_PEPPER || authSecret();
function fallbackPeppers() {
  const list: string[] = [];
  if (process.env.PIN_LEGACY_FALLBACK !== 'off') list.push(authSecret());
  if (process.env.PIN_PEPPER_PREVIOUS) list.push(process.env.PIN_PEPPER_PREVIOUS);
  return list.filter((value, index) => value && value !== primaryPepper() && list.indexOf(value) === index);
}
export const hashProfilePin = (profileId: string, pin: string) => hashPinWithPepper(primaryPepper(), profileId, pin);

/** 'current' = verified with the primary pepper, 'legacy' = verified with an older one (should be upgraded), null = wrong PIN. */
export const verifyProfilePin = (profileId: string, pin: string, stored: string) => verifyPinWithPeppers(primaryPepper(), fallbackPeppers(), profileId, pin, stored);

/**
 * Replaces an old-pepper hash with one made with the primary pepper. Compare-and-set on the stored hash, so a PIN changed
 * in the meantime is never overwritten. Best effort: a failure must not stop the unlock, and nothing sensitive is logged.
 */
export async function upgradeProfilePinHash(profileId: string, pin: string, previousHash: string) {
  try {
    await prisma.profile.updateMany({ where: { id: profileId, profilePinHash: previousHash }, data: { profilePinHash: await hashProfilePin(profileId, pin) } });
  } catch {
    // the old hash keeps working; the upgrade is retried at the next successful unlock
  }
}

// Online guessing is capped by persistent attempt limits with temporary lockouts, stored in the existing AuthAttempt
// table: 5 failures per profile in 15 minutes lock that profile for the rest of the window, and 20 failures across all
// of an account's profiles lock them all. Nothing is kept in memory, so a restart or another server instance cannot
// reset it.
const WINDOW_MS = 15 * 60 * 1000;
const MAX_PROFILE_FAILURES = 5;
const MAX_ACCOUNT_FAILURES = 20;

const keyed = (value: string) => createHmac('sha256', authSecret()).update(value).digest('hex');
export const pinIdentity = (userId: string, profileId: string): AuthIdentity => ({ sourceHash: keyed(`pin|profile|${profileId}`), accountHash: keyed(`pin|account|${userId}`) });

async function secondsUntilBelow(identifierHash: string, limit: number, since: Date, failures: number) {
  const pivot = await prisma.authAttempt.findFirst({
    where: { identifierHash, success: false, createdAt: { gte: since } }, orderBy: { createdAt: 'asc' }, skip: Math.max(0, failures - limit), select: { createdAt: true },
  });
  return Math.max(1, Math.ceil(((pivot?.createdAt.getTime() ?? Date.now()) + WINDOW_MS - Date.now()) / 1000));
}

export interface PinAttemptReservation { ids: string[]; sourceHash: string }

/**
 * Counts the attempt BEFORE the PIN is checked, then checks the limits including this attempt. Because every request
 * records itself first, a burst of parallel guesses cannot all slip under the limit: at most 5 can ever be evaluated.
 * Throws AuthRateLimitError (with retryAfterSeconds) while locked; the reserved failure stays on record in that case.
 */
export async function reservePinAttempt(identity: AuthIdentity): Promise<PinAttemptReservation> {
  const [mine, account] = await Promise.all([
    prisma.authAttempt.create({ data: { identifierHash: identity.sourceHash, success: false }, select: { id: true } }),
    prisma.authAttempt.create({ data: { identifierHash: identity.accountHash, success: false }, select: { id: true } }),
  ]);
  const since = new Date(Date.now() - WINDOW_MS);
  const [profileFailures, accountFailures] = await Promise.all([
    prisma.authAttempt.count({ where: { identifierHash: identity.sourceHash, success: false, createdAt: { gte: since } } }),
    prisma.authAttempt.count({ where: { identifierHash: identity.accountHash, success: false, createdAt: { gte: since } } }),
  ]);
  if (profileFailures > MAX_PROFILE_FAILURES) throw new AuthRateLimitError(await secondsUntilBelow(identity.sourceHash, MAX_PROFILE_FAILURES, since, profileFailures));
  if (accountFailures > MAX_ACCOUNT_FAILURES) throw new AuthRateLimitError(await secondsUntilBelow(identity.accountHash, MAX_ACCOUNT_FAILURES, since, accountFailures));
  return { ids: [mine.id, account.id], sourceHash: identity.sourceHash };
}

/** A correct PIN erases its own reserved attempt and that profile's earlier failures (the account-wide count is kept). */
export async function releasePinAttempt(reservation: PinAttemptReservation) {
  await prisma.authAttempt.deleteMany({ where: { OR: [{ id: { in: reservation.ids } }, { identifierHash: reservation.sourceHash, success: false }] } });
  // keep the table bounded
  if (Math.random() < 0.02) await prisma.authAttempt.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } } });
}
export { AuthRateLimitError };
