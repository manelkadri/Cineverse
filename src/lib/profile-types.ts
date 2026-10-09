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
  language: string;
  watchlist: string[];
  favorites: string[];
  history: ViewingProgress[];
  /** Whether the profile has its 4-digit PIN (false only for profiles created before PIN protection). */
  hasPin: boolean;
  /** True when the profile is not unlocked in this login session; locked profiles carry no personal data. */
  locked: boolean;
}

export interface ProfileDraft {
  name: string;
  avatar: string;
  isKids: boolean;
  maturityLevel: number;
  preferences: string[];
  language?: string;
  parentalPin?: string;
  /** The profile PIN, entered twice, when creating a profile. */
  pin?: string;
  confirmPin?: string;
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

/** An edit of an existing profile; `preferences` is left out for a locked profile, whose preferences are not loaded. */
export type ProfileUpdate = Omit<ProfileDraft, 'preferences'> & { preferences?: string[] };
