import 'server-only';
import { cookies } from 'next/headers';
import { authSecret } from './auth-security';
import { readUnlockToken, signUnlockToken, UNLOCK_MAX_AGE_SECONDS } from './unlock-token';

// "This profile is unlocked in this login session". An HttpOnly, signed cookie names the profile, the user and the
// login session id (the one stored server-side and deleted at logout). It is therefore:
//  - unforgeable (HMAC with a key derived from AUTH_SECRET),
//  - useless in any other login session (logging out or in again revokes it),
//  - single-profile: unlocking another profile replaces it, so switching profiles always needs the PIN again.
// Client state and profile ids in requests are never trusted for this decision.
const secureCookies = () => (process.env.NEXTAUTH_URL ?? '').startsWith('https://') || Boolean(process.env.VERCEL);
export const unlockCookieName = () => (secureCookies() ? '__Secure-cv-unlock' : 'cv-unlock');
export const unlockCookieOptions = () => ({ httpOnly: true, sameSite: 'lax' as const, secure: secureCookies(), path: '/', maxAge: UNLOCK_MAX_AGE_SECONDS });
export const signUnlock = (claim: { sid: string; userId: string; profileId: string }) => signUnlockToken(authSecret(), claim);

/** The profile unlocked in this login session, or null. */
export async function unlockedProfileId(context: { userId: string; sid: string }) {
  const claim = readUnlockToken(authSecret(), (await cookies()).get(unlockCookieName())?.value);
  return claim && claim.s === context.sid && claim.u === context.userId ? claim.p : null;
}
