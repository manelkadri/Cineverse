import { hash } from 'bcryptjs';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticatedContext } from '@/lib/server-auth';
import { isAuthRuntimeConfigured } from '@/lib/auth-security';
import { profileInclude, toClientProfile, toLockedProfile } from '@/lib/profile-db';
import { profileCreateSchema } from '@/lib/validation';
import { hashProfilePin } from '@/lib/profile-pin';
import { unlockedProfileId } from '@/lib/profile-unlock';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  if (!isAuthRuntimeConfigured()) return NextResponse.json({ error: 'Database authentication is not configured', databaseConfigured: false }, { status: 503 });
  const context = await authenticatedContext();
  if (!context) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  const profiles = await prisma.profile.findMany({ where: { userId: context.userId }, include: profileInclude, orderBy: { createdAt: 'asc' } });
  // Only the profile whose PIN was verified in this login session shows its personal data or counts as "selected".
  const unlocked = await unlockedProfileId(context);
  const visible = profiles.map((profile) => (profile.id === unlocked ? toClientProfile(profile) : toLockedProfile(profile)));
  return NextResponse.json({ profiles: visible, selectedProfileId: visible.some((profile) => profile.id === unlocked) ? unlocked : null, databaseConfigured: true });
}

export async function POST(request: Request) {
  if (!isAuthRuntimeConfigured()) return NextResponse.json({ error: 'Database authentication is not configured' }, { status: 503 });
  const context = await authenticatedContext();
  if (!context) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  const parsed = profileCreateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    const fields = parsed.error.flatten().fieldErrors;
    return NextResponse.json({ error: fields.pin?.[0] ?? fields.confirmPin?.[0] ?? 'Invalid profile data', fields }, { status: 400 });
  }
  const userId = context.userId;
  const count = await prisma.profile.count({ where: { userId } });
  if (count >= 5) return NextResponse.json({ error: 'Profile limit reached' }, { status: 409 });
  const input = parsed.data;
  if (input.isKids && !input.parentalPin) return NextResponse.json({ error: 'A four-digit parental PIN is required for kids profiles' }, { status: 400 });
  const parentalPinHash = input.parentalPin ? await hash(input.parentalPin, 12) : null;
  const maturityLevel = input.isKids ? Math.min(input.maturityLevel, 10) : Math.min(input.maturityLevel, 18);
  const created = await prisma.profile.create({
    data: {
      userId, name: input.name, avatar: input.avatar, isKids: input.isKids, maturityLevel,
      preferences: input.preferences, language: input.language, parentalPinHash,
      preferenceDetails: { create: { preferredGenres: input.preferences, preferredLanguage: input.language } },
    },
  });
  // The PIN hash is bound to the profile id, which only exists once the row is created.
  const profile = await prisma.profile.update({ where: { id: created.id }, data: { profilePinHash: await hashProfilePin(created.id, input.pin) }, include: profileInclude });
  return NextResponse.json({ profile: toLockedProfile(profile) }, { status: 201 });
}
