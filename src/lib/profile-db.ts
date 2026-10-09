import type { Prisma } from '@prisma/client';
import type { CineverseProfile } from './profile-types';
import { parseMediaId } from './media-id';

export const profileInclude = {
  watchlist: { orderBy: { addedAt: 'asc' as const } },
  favorites: { orderBy: { addedAt: 'asc' as const } },
  viewingHistory: { orderBy: { lastWatchedAt: 'desc' as const } },
  watchProgress: { orderBy: { updatedAt: 'desc' as const } },
  preferenceDetails: true,
} satisfies Prisma.ProfileInclude;

export type DatabaseProfile = Prisma.ProfileGetPayload<{ include: typeof profileInclude }>;

export function toClientProfile(profile: DatabaseProfile): CineverseProfile {
  return {
    id: profile.id,
    name: profile.name,
    avatar: profile.avatar,
    isKids: profile.isKids,
    maturityLevel: profile.maturityLevel,
    preferences: profile.preferences,
    language: profile.language,
    watchlist: profile.watchlist.map((item) => item.mediaId),
    favorites: profile.favorites.map((item) => item.mediaId),
    history: (profile.watchProgress.length ? profile.watchProgress : profile.viewingHistory).map((item) => ({
      mediaId: item.mediaId,
      positionSeconds: item.positionSeconds,
      durationSeconds: item.durationSeconds,
      updatedAt: ('updatedAt' in item ? item.updatedAt : item.lastWatchedAt).toISOString(),
    })),
  };
}

export function mediaDataFor(mediaId: string) {
  const parsed = parseMediaId(mediaId);
  if (!parsed) throw new Error('Invalid media ID');
  return { tmdbId: parsed.tmdbId, mediaType: parsed.mediaType };
}
