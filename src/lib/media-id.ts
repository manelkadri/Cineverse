import type { MediaType } from './profile-types';

const LEGACY_IDS: Record<string, string> = {
  'dune-part-two': 'movie:693134', 'the-last-of-us': 'tv:100088', oppenheimer: 'movie:872585',
  'breaking-bad': 'tv:1396', interstellar: 'movie:157336', 'stranger-things': 'tv:66732',
  'house-of-the-dragon': 'tv:94997', 'the-boys': 'tv:76479', 'joker-folie-a-deux': 'movie:889737',
  'inside-out-2': 'movie:1022789', 'the-mandalorian': 'tv:82856', inception: 'movie:27205',
  arrival: 'movie:329865', fallout: 'tv:106379', dark: 'tv:70523', 'paddington-2': 'movie:346648',
};

export function makeMediaId(type: MediaType, id: number) {
  return `${type}:${id}`;
}

export function parseMediaId(value: string): { mediaType: MediaType; tmdbId: number } | null {
  const normalized = LEGACY_IDS[value] ?? value;
  const match = /^(movie|tv):(\d+)$/.exec(normalized);
  if (!match) return null;
  return { mediaType: match[1] as MediaType, tmdbId: Number(match[2]) };
}

export function normalizeMediaId(value: string) {
  const parsed = parseMediaId(value);
  return parsed ? makeMediaId(parsed.mediaType, parsed.tmdbId) : value;
}

export function mediaDetailHref(value: string) {
  const parsed = parseMediaId(value);
  return parsed ? `/movie-series-detail?id=${parsed.tmdbId}&type=${parsed.mediaType}` : '/films-series-catalog';
}
