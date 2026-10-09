import 'server-only';
import { prisma } from './prisma';
import { getMediaDetails } from './tmdb';
import { parseMediaId } from './media-id';

export async function ownedProfile(userId: string, profileId: string) {
  return prisma.profile.findFirst({ where: { id: profileId, userId } });
}

export async function ensureProfileMediaAllowed(profile: { isKids: boolean; maturityLevel: number }, mediaId: string) {
  if (!profile.isKids) return true;
  const parsed = parseMediaId(mediaId);
  if (!parsed) return false;
  const details = await getMediaDetails(parsed.mediaType, parsed.tmdbId);
  return details.maturityLevel <= profile.maturityLevel;
}

export async function activeProfileAccess(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { selectedProfileId: true } });
  if (!user?.selectedProfileId) return null;
  return prisma.profile.findFirst({ where: { id: user.selectedProfileId, userId }, select: { id: true, isKids: true, maturityLevel: true } });
}
