import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getProviderUserId, mediaTypeFor, profileInclude, toClientProfile } from '@/lib/profile-db';
import type { CineverseProfile } from '@/lib/profile-types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: 'DATABASE_URL is not configured', databaseConfigured: false }, { status: 503 });
  }
  const providerUserId = getProviderUserId(request);
  if (!providerUserId) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  const user = await prisma.user.upsert({
    where: { providerUserId },
    update: {},
    create: { providerUserId },
    include: { profiles: { include: profileInclude, orderBy: { createdAt: 'asc' } } },
  });
  return NextResponse.json({
    profiles: user.profiles.map(toClientProfile),
    selectedProfileId: user.selectedProfileId,
    databaseConfigured: true,
  });
}

export async function POST(request: Request) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: 'DATABASE_URL is not configured' }, { status: 503 });
  }
  const input = (await request.json()) as CineverseProfile & { parentalPin?: string };
  if (!input.id || !input.name?.trim()) return NextResponse.json({ error: 'Invalid profile' }, { status: 400 });

  const providerUserId = getProviderUserId(request);
  if (!providerUserId) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  const user = await prisma.user.upsert({ where: { providerUserId }, update: {}, create: { providerUserId } });
  const existing = await prisma.profile.findUnique({ where: { id: input.id } });
  if (existing && existing.userId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const parentalPinHash = input.parentalPin
    ? createHash('sha256').update(input.parentalPin).digest('hex')
    : existing?.parentalPinHash;

  const profile = await prisma.$transaction(async (tx) => {
    await tx.profile.upsert({
      where: { id: input.id },
      update: { name: input.name.trim(), avatar: input.avatar, isKids: input.isKids, maturityLevel: input.isKids ? Math.min(input.maturityLevel, 10) : input.maturityLevel, preferences: input.preferences, parentalPinHash },
      create: { id: input.id, userId: user.id, name: input.name.trim(), avatar: input.avatar, isKids: input.isKids, maturityLevel: input.isKids ? Math.min(input.maturityLevel, 10) : input.maturityLevel, preferences: input.preferences, parentalPinHash },
    });
    await tx.watchlistItem.deleteMany({ where: { profileId: input.id } });
    await tx.favoriteItem.deleteMany({ where: { profileId: input.id } });
    await tx.viewingActivity.deleteMany({ where: { profileId: input.id } });
    if (input.watchlist.length) await tx.watchlistItem.createMany({ data: input.watchlist.map((mediaId) => ({ profileId: input.id, mediaId, mediaType: mediaTypeFor(mediaId) })) });
    if (input.favorites.length) await tx.favoriteItem.createMany({ data: input.favorites.map((mediaId) => ({ profileId: input.id, mediaId, mediaType: mediaTypeFor(mediaId) })) });
    if (input.history.length) await tx.viewingActivity.createMany({ data: input.history.map((item) => ({ profileId: input.id, mediaId: item.mediaId, mediaType: mediaTypeFor(item.mediaId), positionSeconds: item.positionSeconds, durationSeconds: item.durationSeconds, completed: item.durationSeconds > 0 && item.positionSeconds / item.durationSeconds >= 0.95, lastWatchedAt: new Date(item.updatedAt) })) });
    return tx.profile.findUniqueOrThrow({ where: { id: input.id }, include: profileInclude });
  });

  return NextResponse.json({ profile: toClientProfile(profile) });
}
