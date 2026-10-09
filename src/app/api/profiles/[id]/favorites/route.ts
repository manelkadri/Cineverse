import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isAuthRuntimeConfigured } from '@/lib/auth-security';
import { ensureProfileMediaAllowed, requireUnlockedProfile } from '@/lib/profile-access';
import { mediaDataFor } from '@/lib/profile-db';
import { mediaActionSchema } from '@/lib/validation';

export const runtime = 'nodejs';

async function context(request: Request, params: Promise<{ id: string }>) {
  if (!isAuthRuntimeConfigured()) return { response: NextResponse.json({ error: 'Database authentication is not configured' }, { status: 503 }) };
  const { id } = await params;
  const gate = await requireUnlockedProfile(id);
  if ('response' in gate) return { response: gate.response };
  const parsed = mediaActionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return { response: NextResponse.json({ error: 'Invalid media identifier' }, { status: 400 }) };
  return { profile: gate.profile, mediaId: parsed.data.mediaId };
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const result = await context(request, params);
  if ('response' in result) return result.response;
  if (!await ensureProfileMediaAllowed(result.profile, result.mediaId)) return NextResponse.json({ error: 'Content is not allowed for this profile' }, { status: 403 });
  const media = mediaDataFor(result.mediaId);
  await prisma.favoriteItem.upsert({
    where: { profileId_mediaId: { profileId: result.profile.id, mediaId: result.mediaId } },
    update: { tmdbId: media.tmdbId, mediaType: media.mediaType },
    create: { profileId: result.profile.id, mediaId: result.mediaId, tmdbId: media.tmdbId, mediaType: media.mediaType },
  });
  return NextResponse.json({ saved: true });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const result = await context(request, params);
  if ('response' in result) return result.response;
  await prisma.favoriteItem.deleteMany({ where: { profileId: result.profile.id, mediaId: result.mediaId } });
  return NextResponse.json({ saved: false });
}
