export type MediaType = 'movie' | 'tv';

export interface ViewingProgress {
  mediaId: string;
  positionSeconds: number;
  durationSeconds: number;
  updatedAt: string;
}

export interface CineverseProfile {
  id: string;
  name: string;
  avatar: string;
  isKids: boolean;
  maturityLevel: number;
  preferences: string[];
  watchlist: string[];
  favorites: string[];
  history: ViewingProgress[];
}

export interface ProfileDraft {
  name: string;
  avatar: string;
  isKids: boolean;
  maturityLevel: number;
  preferences: string[];
  parentalPin?: string;
}

export interface ContentItem {
  id: string;
  tmdbId: number;
  title: string;
  posterPath: string;
  backdropPath: string;
  year: number;
  rating: number;
  mediaType: MediaType;
  genres: string[];
  maturityLevel: number;
  durationSeconds: number;
  overview?: string;
}
