// Client-safe helpers for TMDB artwork. TMDB serves pre-resized images from its CDN, so the
// browser can request the right size directly instead of going through the Next.js optimizer
// (whose server-side fetch has a hard 7 second limit and no retry).
const TMDB_URL_PATTERN = /^https:\/\/image\.tmdb\.org\/t\/p\/([a-z0-9]+)(\/.+)$/i;
const TMDB_MARKER_PATTERN = /^tmdb:([a-z0-9]+)(\/.+)$/i;

type ImageKind = 'poster' | 'backdrop' | 'profile';

// Sizes published by TMDB's /configuration endpoint, as [maximum width in px served, size token].
const LADDERS: Record<ImageKind, ReadonlyArray<readonly [number, string]>> = {
  poster: [[92, 'w92'], [154, 'w154'], [185, 'w185'], [342, 'w342'], [500, 'w500'], [780, 'w780']],
  backdrop: [[300, 'w300'], [780, 'w780'], [1280, 'w1280']],
  profile: [[45, 'w45'], [185, 'w185']],
};

// The size token already stored in each URL tells us what kind of artwork it is.
const KIND_BY_TOKEN: Record<string, ImageKind> = {
  w92: 'poster', w154: 'poster', w342: 'poster', w500: 'poster',
  original: 'backdrop', w300: 'backdrop', w1280: 'backdrop',
  w45: 'profile', w185: 'profile', h632: 'profile',
};

export function isTmdbImageUrl(src: string) {
  return TMDB_URL_PATTERN.test(src);
}

/**
 * Converts a TMDB CDN URL into the marker form handed to next/image (`tmdb:w500/abc.jpg`).
 * The marker never equals the loader's output, which keeps next/image from warning that a
 * loader "does not implement width", and it carries no query string that could miss the CDN cache.
 */
export function toTmdbMarker(src: string) {
  const match = TMDB_URL_PATTERN.exec(src);
  return match ? `tmdb:${match[1]}${match[2]}` : src;
}

// A size up to 15% narrower than the requested width is visually indistinguishable but noticeably lighter.
const UNDERSHOOT_TOLERANCE = 1.15;

/** Smallest published TMDB size that covers `width` pixels (within a 15% tolerance). */
export function tmdbSizeFor(kind: ImageKind, width: number) {
  const ladder = LADDERS[kind];
  const match = ladder.find(([max]) => width <= max * UNDERSHOOT_TOLERANCE);
  if (match) return match[1];
  if (kind === 'backdrop') return 'original';
  if (kind === 'profile') return 'h632';
  return ladder[ladder.length - 1][1];
}

/**
 * next/image loader for TMDB artwork: returns the CDN URL sized for the requested width.
 * `attempt` adds a cache-busting parameter so a retry opens a fresh request after a failure.
 */
export function tmdbImageLoader(src: string, width: number, attempt = 0) {
  const match = TMDB_MARKER_PATTERN.exec(src) ?? TMDB_URL_PATTERN.exec(src);
  if (!match) return src;
  const kind = KIND_BY_TOKEN[match[1].toLowerCase()];
  if (!kind) return `https://image.tmdb.org/t/p/${match[1]}${match[2]}`;
  const url = `https://image.tmdb.org/t/p/${tmdbSizeFor(kind, width)}${match[2]}`;
  return attempt > 0 ? `${url}?retry=${attempt}` : url;
}
