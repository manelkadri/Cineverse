import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isAuthRuntimeConfigured } from '@/lib/auth-security';
import { ensureProfileMediaAllowed, requireUnlockedProfile } from '@/lib/profile-access';
import { mediaDataFor } from '@/lib/profile-db';
import { mediaActionSchema, progressInputSchema } from '@/lib/validation';
import { playbackCompleted, playbackProgressKey } from '@/lib/viewing';

export const runtime = 'nodejs';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isAuthRuntimeConfigured()) return NextResponse.json({ error: 'Database authentication is not configured' }, { status: 503 });
  const { id } = await params;
  const gate = await requireUnlockedProfile(id);
  if ('response' in gate) return gate.response;
  const profile = gate.profile;
  if (process.env.AUTHORIZED_PLAYBACK_ENABLED !== 'true') return NextResponse.json({ error: 'No authorized playback source is configured' }, { status: 409 });
  const parsed = progressInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid playback progress' }, { status: 400 });
  if (!await ensureProfileMediaAllowed(profile, parsed.data.mediaId)) return NextResponse.json({ error: 'Content is not allowed for this profile' }, { status: 403 });
  const input = parsed.data;
  const media = mediaDataFor(input.mediaId);
  const completed = playbackCompleted(input.positionSeconds, input.durationSeconds);
  const progressKey = playbackProgressKey(input.mediaId, input.seasonNumber, input.episodeNumber);
  await prisma.$transaction([
    prisma.viewingActivity.upsert({
      where: { profileId_mediaId: { profileId: profile.id, mediaId: input.mediaId } },
      update: { ...media, seasonNumber: input.seasonNumber, episodeNumber: input.episodeNumber, positionSeconds: input.positionSeconds, durationSeconds: input.durationSeconds, completed, lastWatchedAt: new Date() },
      create: { profileId: profile.id, mediaId: input.mediaId, ...media, seasonNumber: input.seasonNumber, episodeNumber: input.episodeNumber, positionSeconds: input.positionSeconds, durationSeconds: input.durationSeconds, completed },
    }),
    prisma.watchProgress.upsert({
      where: { profileId_progressKey: { profileId: profile.id, progressKey } },
      update: { positionSeconds: input.positionSeconds, durationSeconds: input.durationSeconds, completed },
      create: { profileId: profile.id, progressKey, mediaId: input.mediaId, ...media, seasonNumber: input.seasonNumber, episodeNumber: input.episodeNumber, positionSeconds: input.positionSeconds, durationSeconds: input.durationSeconds, completed },
    }),
  ]);
  return NextResponse.json({ saved: true, completed });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isAuthRuntimeConfigured()) return NextResponse.json({ error: 'Database authentication is not configured' }, { status: 503 });
  const { id } = await params;
  const gate = await requireUnlockedProfile(id);
  if ('response' in gate) return gate.response;
  const profile = gate.profile;
  const parsed = mediaActionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid media identifier' }, { status: 400 });
  await prisma.$transaction([
    prisma.viewingActivity.deleteMany({ where: { profileId: profile.id, mediaId: parsed.data.mediaId } }),
    prisma.watchProgress.deleteMany({ where: { profileId: profile.id, mediaId: parsed.data.mediaId } }),
  ]);
  return NextResponse.json({ deleted: true });
}
