import type { CineverseProfile } from './profile-types';

export const DEFAULT_PROFILES: CineverseProfile[] = [
  {
    id: 'profile-alex', name: 'Alex', avatar: 'ember', isKids: false, maturityLevel: 18,
    preferences: ['Science-fiction', 'Drame', 'Thriller'],
    watchlist: ['dune-part-two', 'interstellar', 'the-last-of-us', 'joker-folie-a-deux'],
    favorites: ['interstellar', 'breaking-bad'],
    history: [
      { mediaId: 'the-last-of-us', positionSeconds: 3010, durationSeconds: 4860, updatedAt: '2026-10-07T20:30:00.000Z' },
      { mediaId: 'oppenheimer', positionSeconds: 3670, durationSeconds: 10800, updatedAt: '2026-10-06T18:20:00.000Z' },
    ],
  },
  {
    id: 'profile-sophie', name: 'Sophie', avatar: 'violet', isKids: false, maturityLevel: 16,
    preferences: ['Drame', 'Fantastique', 'Mystère'],
    watchlist: ['house-of-the-dragon', 'arrival', 'dark'],
    favorites: ['arrival', 'house-of-the-dragon'],
    history: [{ mediaId: 'stranger-things', positionSeconds: 1820, durationSeconds: 3900, updatedAt: '2026-10-08T10:00:00.000Z' }],
  },
  {
    id: 'profile-kids', name: 'Enfants', avatar: 'mint', isKids: true, maturityLevel: 10,
    preferences: ['Animation', 'Famille', 'Aventure'],
    watchlist: ['inside-out-2', 'paddington-2', 'the-mandalorian'],
    favorites: ['inside-out-2'],
    history: [{ mediaId: 'inside-out-2', positionSeconds: 1320, durationSeconds: 5760, updatedAt: '2026-10-08T08:15:00.000Z' }],
  },
];
