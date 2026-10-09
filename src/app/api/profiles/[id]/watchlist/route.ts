import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authenticatedUserId } from '@/lib/server-auth';
import { isAuthRuntimeConfigured } from '@/lib/auth-security';
import { ensureProfileMediaAllowed, ownedProfile } from '@/lib/profile-access';
import { mediaDataFor } from '@/lib/profile-db';
import { mediaActionSchema } from '@/lib/validation';

export const runtime = 'nodejs';

async function context(request: Request, params: Promise<{ id: string }>) {
  if (!isAuthRuntimeConfigured()) return { response: NextResponse.json({ error: 'Database authentication is not configured' }, { status: 503 }) };
  const userId = await authenticatedUserId();
  if (!userId) return { response: NextResponse.json({ error: 'Authentication required' }, { status: 401 }) };
  const { id } = await params;
  const profile = await ownedProfile(userId, id);
  if (!profile) return { response: NextResponse.json({ error: 'Profile not found' }, { status: 404 }) };
  const parsed = mediaActionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return { response: NextResponse.json({ error: 'Invalid media identifier' }, { status: 400 }) };
  return { profile, mediaId: parsed.data.mediaId };
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const result = await context(request, params);
  if ('response' in result) return result.response;
  if (!await ensureProfileMediaAllowed(result.profile, result.mediaId)) return NextResponse.json({ error: 'Content is not allowed for this profile' }, { status: 403 });
  const media = mediaDataFor(result.mediaId);
  await prisma.watchlistItem.upsert({
    where: { profileId_mediaId: { profileId: result.profile.id, mediaId: result.mediaId } },
    update: { tmdbId: media.tmdbId, mediaType: media.mediaType },
    create: { profileId: result.profile.id, mediaId: result.mediaId, tmdbId: media.tmdbId, mediaType: media.mediaType },
  });
  return NextResponse.json({ saved: true });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const result = await context(request, params);
  if ('response' in result) return result.response;
  await prisma.watchlistItem.deleteMany({ where: { profileId: result.profile.id, mediaId: result.mediaId } });
  return NextResponse.json({ saved: false });
}
