import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticatedContext } from '@/lib/server-auth';
import { isAuthRuntimeConfigured } from '@/lib/auth-security';
import { reauthDenied, verifyAccountPassword } from '@/lib/account-reauth';
import { hashProfilePin, pinIdentity } from '@/lib/profile-pin';
import { grantProfileUnlock } from '@/lib/profile-session';
import { pinSetSchema } from '@/lib/validation';

export const runtime = 'nodejs';

// Sets or changes a profile's 4-digit PIN.
//  - Profile with no PIN yet (created before PIN protection): the first PIN needs no password, because nothing was
//    protecting it before, and the profile is unlocked right away. Nothing is deleted or reset.
//  - Profile that already has a PIN (change, or "I forgot it"): fresh authentication with the account password is
//    required, and the profile's failed-attempt lockout is cleared.
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isAuthRuntimeConfigured()) return NextResponse.json({ error: 'Database authentication is not configured' }, { status: 503 });
  const context = await authenticatedContext();
  if (!context) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  const { id } = await params;
  const parsed = pinSetSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    const fields = parsed.error.flatten().fieldErrors;
    return NextResponse.json({ error: fields.pin?.[0] ?? fields.confirmPin?.[0] ?? 'Code PIN invalide.', code: 'PIN_INVALID', fields }, { status: 400 });
  }
  const profile = await prisma.profile.findFirst({ where: { id, userId: context.userId }, select: { id: true, profilePinHash: true } });
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  const profilePinHash = await hashProfilePin(profile.id, parsed.data.pin);

  if (!profile.profilePinHash) {
    // `profilePinHash: null` in the condition makes this race-safe: only the first of two simultaneous requests wins.
    const { count } = await prisma.profile.updateMany({ where: { id: profile.id, userId: context.userId, profilePinHash: null }, data: { profilePinHash } });
    if (count === 0) return NextResponse.json({ error: 'Un code PIN existe déjà pour ce profil.', code: 'PIN_ALREADY_SET' }, { status: 409 });
    return grantProfileUnlock(context, profile.id);
  }

  if (!parsed.data.password) return NextResponse.json({ error: 'Le mot de passe du compte est requis pour changer le code PIN.', code: 'PASSWORD_REQUIRED' }, { status: 400 });
  const denied = reauthDenied(await verifyAccountPassword(context.userId, parsed.data.password, request.headers));
  if (denied) return denied;
  await prisma.profile.update({ where: { id: profile.id }, data: { profilePinHash } });
  await prisma.authAttempt.deleteMany({ where: { identifierHash: pinIdentity(context.userId, profile.id).sourceHash, success: false } });
  return NextResponse.json({ updated: true });
}
