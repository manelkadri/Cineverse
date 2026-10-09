import { hash } from 'bcryptjs';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticatedUserId } from '@/lib/server-auth';
import { isAuthRuntimeConfigured } from '@/lib/auth-security';
import { profileInclude, toClientProfile } from '@/lib/profile-db';
import { profileInputSchema } from '@/lib/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  if (!isAuthRuntimeConfigured()) return NextResponse.json({ error: 'Database authentication is not configured', databaseConfigured: false }, { status: 503 });
  const userId = await authenticatedUserId();
  if (!userId) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  const user = await prisma.user.findUnique({ where: { id: userId }, include: { profiles: { include: profileInclude, orderBy: { createdAt: 'asc' } } } });
  if (!user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  return NextResponse.json({ profiles: user.profiles.map(toClientProfile), selectedProfileId: user.selectedProfileId, databaseConfigured: true });
}

export async function POST(request: Request) {
  if (!isAuthRuntimeConfigured()) return NextResponse.json({ error: 'Database authentication is not configured' }, { status: 503 });
  const userId = await authenticatedUserId();
  if (!userId) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  const parsed = profileInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid profile data', fields: parsed.error.flatten().fieldErrors }, { status: 400 });
  const count = await prisma.profile.count({ where: { userId } });
  if (count >= 5) return NextResponse.json({ error: 'Profile limit reached' }, { status: 409 });
  const input = parsed.data;
  if (input.isKids && !input.parentalPin) return NextResponse.json({ error: 'A four-digit parental PIN is required for kids profiles' }, { status: 400 });
  const parentalPinHash = input.parentalPin ? await hash(input.parentalPin, 12) : null;
  const maturityLevel = input.isKids ? Math.min(input.maturityLevel, 10) : Math.min(input.maturityLevel, 18);
  const profile = await prisma.profile.create({
    data: {
      userId, name: input.name, avatar: input.avatar, isKids: input.isKids, maturityLevel,
      preferences: input.preferences, language: input.language, parentalPinHash,
      preferenceDetails: { create: { preferredGenres: input.preferences, preferredLanguage: input.language } },
    },
    include: profileInclude,
  });
  return NextResponse.json({ profile: toClientProfile(profile) }, { status: 201 });
}
