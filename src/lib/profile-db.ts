import type { Prisma } from '@prisma/client';
import type { CineverseProfile } from './profile-types';
import { parseMediaId } from './media-id';

export const profileInclude = {
  watchlist: { orderBy: { addedAt: 'asc' as const } },
  favorites: { orderBy: { addedAt: 'asc' as const } },
  viewingHistory: { orderBy: { lastWatchedAt: 'desc' as const } },
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
    watchlist: profile.watchlist.map((item) => item.mediaId),
    favorites: profile.favorites.map((item) => item.mediaId),
    history: profile.viewingHistory.map((item) => ({
      mediaId: item.mediaId,
      positionSeconds: item.positionSeconds,
      durationSeconds: item.durationSeconds,
      updatedAt: item.lastWatchedAt.toISOString(),
    })),
  };
}

export function mediaTypeFor(mediaId: string) {
  return parseMediaId(mediaId)?.mediaType ?? 'movie';
}

export function getProviderUserId(request: Request) {
  const value = request.headers.get('x-cineverse-user-id')?.trim();
  return value || null;
}
