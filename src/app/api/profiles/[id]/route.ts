import { compare, hash } from 'bcryptjs';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticatedUserId } from '@/lib/server-auth';
import { isAuthRuntimeConfigured } from '@/lib/auth-security';
import { profileInclude, toClientProfile } from '@/lib/profile-db';
import { profilePatchSchema } from '@/lib/validation';

export const runtime = 'nodejs';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isAuthRuntimeConfigured()) return NextResponse.json({ error: 'Database authentication is not configured' }, { status: 503 });
  const userId = await authenticatedUserId();
  if (!userId) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  const { id } = await params;
  const parsed = profilePatchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid profile data', fields: parsed.error.flatten().fieldErrors }, { status: 400 });
  const current = await prisma.profile.findFirst({ where: { id, userId } });
  if (!current) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  const input = parsed.data;
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
  return NextResponse.json({ profile: toClientProfile(profile) });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isAuthRuntimeConfigured()) return NextResponse.json({ error: 'Database authentication is not configured' }, { status: 503 });
  const userId = await authenticatedUserId();
  if (!userId) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  const { id } = await params;
  const profile = await prisma.profile.findFirst({ where: { id, userId }, select: { id: true, parentalPinHash: true } });
  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
  if (profile.parentalPinHash) {
    const body = await request.json().catch(() => ({})) as { parentalPin?: string };
    const validPin = Boolean(body.parentalPin && await compare(body.parentalPin, profile.parentalPinHash));
    if (!validPin) return NextResponse.json({ error: 'Valid parental PIN required' }, { status: 403 });
  }
  await prisma.$transaction([
    prisma.profile.delete({ where: { id } }),
    prisma.user.updateMany({ where: { id: userId, selectedProfileId: id }, data: { selectedProfileId: null } }),
  ]);
  return NextResponse.json({ deleted: true });
}
