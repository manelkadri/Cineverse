import 'server-only';
import { compare } from 'bcryptjs';
import { NextResponse } from 'next/server';
import { prisma } from './prisma';
import { authIdentity, AuthRateLimitError, enforceAuthRateLimit, recordAuthAttempt } from './auth-security';

export type ReauthResult = { ok: true } | { ok: false; status: number; body: { error: string; code: string; retryAfterSeconds?: number }; retryAfter?: number };

/**
 * Fresh authentication for sensitive profile management: the signed-in user must give their account password again.
 * Wrong guesses count toward the same persistent lockout as the login form, so this cannot be used to brute-force it.
 */
export async function verifyAccountPassword(userId: string, password: string, requestHeaders: Headers): Promise<ReauthResult> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, passwordHash: true } });
  if (!user?.email || !user.passwordHash) return { ok: false, status: 403, body: { error: 'Mot de passe incorrect.', code: 'PASSWORD_INCORRECT' } };
  const identity = authIdentity(user.email, requestHeaders);
  try {
    await enforceAuthRateLimit(identity);
  } catch (error) {
    if (error instanceof AuthRateLimitError) return { ok: false, status: 429, retryAfter: error.retryAfterSeconds, body: { error: 'Trop de tentatives. Réessayez plus tard.', code: 'RATE_LIMITED', retryAfterSeconds: error.retryAfterSeconds } };
    throw error;
  }
  const valid = await compare(password, user.passwordHash);
  await recordAuthAttempt(identity, valid);
  return valid ? { ok: true } : { ok: false, status: 403, body: { error: 'Mot de passe incorrect.', code: 'PASSWORD_INCORRECT' } };
}

/** Turns a failed fresh-authentication check into the HTTP response to send, or null when it passed. */
export function reauthDenied(result: ReauthResult): NextResponse | null {
  if (result.ok === true) return null;
  const failure = result as Exclude<ReauthResult, { ok: true }>;
  return NextResponse.json(failure.body, { status: failure.status, headers: failure.retryAfter ? { 'Retry-After': String(failure.retryAfter) } : undefined });
}
