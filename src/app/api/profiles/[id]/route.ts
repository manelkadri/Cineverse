import { compare, hash } from 'bcryptjs';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticatedContext } from '@/lib/server-auth';
import { isAuthRuntimeConfigured } from '@/lib/auth-security';
import { profileInclude, toClientProfile, toLockedProfile } from '@/lib/profile-db';
import { profileDeleteSchema, profilePatchSchema } from '@/lib/validation';
import { reauthDenied, verifyAccountPassword } from '@/lib/account-reauth';
import { unlockCookieName, unlockedProfileId } from '@/lib/profile-unlock';

export const runtime = 'nodejs';

// Editing a profile is a management action: it needs the account password again (fresh authentication), whatever
// the unlock state, so someone who merely sits at a signed-in device cannot rename, restyle or reconfigure profiles.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isAuthRuntimeConfigured()) return NextResponse.json({ error: 'Database authentication is not configured' }, { status: 503 });
  const context = await authenticatedContext();
  if (!context) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  const userId = context.userId;
  const { id } = await params;
  const parsed = profilePatchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid profile data', fields: parsed.error.flatten().fieldErrors }, { status: 400 });
  const current = await prisma.profile.findFirst({ where: { id, userId } });
  if (!current) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  const { password, ...input } = parsed.data;
  const denied = reauthDenied(await verifyAccountPassword(userId, password, request.headers));
  if (denied) return denied;
  const changesParentalSettings = input.isKids !== undefined || input.maturityLevel !== undefined;
  if (changesParentalSettings && current.parentalPinHash) {
    const validPin = Boolean(input.parentalPin && await compare(input.parentalPin, current.parentalPinHash));
    if (!validPin) return NextResponse.json({ error: 'Valid parental PIN required' }, { status: 403 });
  }
  const parentalPinHash = !current.parentalPinHash && input.parentalPin ? await hash(input.parentalPin, 12) : current.parentalPinHash;
  const nextIsKids = input.isKids ?? current.isKids;
  const nextMaturity = input.maturityLevel ?? current.maturityLevel;
  if (nextIsKids && !current.parentalPinHash && !input.parentalPin) return NextResponse.json({ error: 'A four-digit parental PIN is required for kids profiles' }, { status: 400 });
  const profile = await prisma.profile.update({
    where: { id },
    data: {
      name: input.name, avatar: input.avatar, isKids: input.isKids,
      maturityLevel: input.maturityLevel === undefined ? undefined : nextIsKids ? Math.min(nextMaturity, 10) : Math.min(nextMaturity, 18),
      preferences: input.preferences, language: input.language, parentalPinHash,
      preferenceDetails: input.preferences || input.language ? {
        upsert: {
          create: { preferredGenres: input.preferences ?? current.preferences, preferredLanguage: input.language ?? current.language },
          update: { preferredGenres: input.preferences, preferredLanguage: input.language },
        },
      } : undefined,
    },
    include: profileInclude,
  });
  const unlocked = (await unlockedProfileId(context)) === profile.id;
  return NextResponse.json({ profile: unlocked ? toClientProfile(profile) : toLockedProfile(profile) });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isAuthRuntimeConfigured()) return NextResponse.json({ error: 'Database authentication is not configured' }, { status: 503 });
  const context = await authenticatedContext();
  if (!context) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  const userId = context.userId;
  const { id } = await params;
  const profile = await prisma.profile.findFirst({ where: { id, userId }, select: { id: true, parentalPinHash: true } });
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  const body = await request.json().catch(() => null);
  // an empty or missing password is reported as such; any other malformed field is a different, generic error
  if (typeof body?.password !== 'string' || body.password.length === 0) return NextResponse.json({ error: 'Le mot de passe du compte est requis pour supprimer un profil.', code: 'PASSWORD_REQUIRED' }, { status: 400 });
  const parsed = profileDeleteSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Demande de suppression invalide.', code: 'INVALID_REQUEST' }, { status: 400 });
  const denied = reauthDenied(await verifyAccountPassword(userId, parsed.data.password, request.headers));
  if (denied) return denied;
  if (profile.parentalPinHash) {
    const validPin = Boolean(parsed.data.parentalPin && await compare(parsed.data.parentalPin, profile.parentalPinHash));
    if (!validPin) return NextResponse.json({ error: 'Valid parental PIN required' }, { status: 403 });
  }
  const wasUnlocked = (await unlockedProfileId(context)) === id;
  await prisma.$transaction([
    prisma.profile.delete({ where: { id } }),
    prisma.user.updateMany({ where: { id: userId, selectedProfileId: id }, data: { selectedProfileId: null } }),
  ]);
  const response = NextResponse.json({ deleted: true });
  if (wasUnlocked) response.cookies.delete(unlockCookieName());
  return response;
}
