import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticatedContext } from '@/lib/server-auth';
import { isAuthRuntimeConfigured } from '@/lib/auth-security';
import { AuthRateLimitError, pinIdentity, releasePinAttempt, reservePinAttempt, upgradeProfilePinHash, verifyProfilePin } from '@/lib/profile-pin';
import { grantProfileUnlock } from '@/lib/profile-session';
import { pinUnlockSchema } from '@/lib/validation';

export const runtime = 'nodejs';

// Verifies a profile's 4-digit PIN. On success the profile becomes the unlocked, selected profile of this login session.
// The PIN is never logged or echoed, a wrong PIN never says which digit was wrong, and guesses are limited persistently.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isAuthRuntimeConfigured()) return NextResponse.json({ error: 'Database authentication is not configured' }, { status: 503 });
  const context = await authenticatedContext();
  if (!context) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  const { id } = await params;
  const parsed = pinUnlockSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Le code PIN doit contenir 4 chiffres.', code: 'PIN_FORMAT' }, { status: 400 });
  const profile = await prisma.profile.findFirst({ where: { id, userId: context.userId }, select: { id: true, profilePinHash: true } });
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  if (!profile.profilePinHash) return NextResponse.json({ error: 'Définissez un code PIN pour ce profil.', code: 'PIN_SETUP_REQUIRED' }, { status: 409 });

  const identity = pinIdentity(context.userId, profile.id);
  let reservation;
  try {
    reservation = await reservePinAttempt(identity);
  } catch (error) {
    if (!(error instanceof AuthRateLimitError)) throw error;
    const minutes = Math.max(1, Math.ceil(error.retryAfterSeconds / 60));
    return NextResponse.json(
      { error: `Trop de tentatives. Réessayez dans ${minutes} minute${minutes > 1 ? 's' : ''}.`, code: 'PIN_LOCKED', retryAfterSeconds: error.retryAfterSeconds },
      { status: 429, headers: { 'Retry-After': String(error.retryAfterSeconds) } },
    );
  }

  const verified = await verifyProfilePin(profile.id, parsed.data.pin, profile.profilePinHash);
  if (!verified) {
    return NextResponse.json({ error: 'Code PIN incorrect', code: 'PIN_INCORRECT' }, { status: 401 });
  }
  await releasePinAttempt(reservation);
  // a PIN that only matched an older pepper is re-hashed with the current one now that the plaintext is proven correct
  if (verified === 'legacy') await upgradeProfilePinHash(profile.id, parsed.data.pin, profile.profilePinHash);
  return grantProfileUnlock(context, profile.id);
}
