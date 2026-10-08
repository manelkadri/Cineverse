import type { CineverseProfile } from './profile-types';

// New accounts intentionally start empty. Profile and activity data must come
// from the user, local persistence, or PostgreSQL—not production demo fixtures.
export const DEFAULT_PROFILES: CineverseProfile[] = [];
