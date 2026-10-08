import 'server-only';
import type { CineverseProfile, ContentItem, MediaType } from './profile-types';
import type { CatalogQuery, CatalogResult, HomeSections, MediaDetails, TrailerVideo } from './tmdb-types';
import { makeMediaId, parseMediaId } from './media-id';

const API_BASE = 'https://api.themoviedb.org/3';
const IMAGE_BASE = 'https://image.tmdb.org/t/p';
const LANGUAGE = process.env.TMDB_LANGUAGE || 'fr-FR';

const GENRE_NAMES: Record<number, string> = {
  12: 'Aventure', 14: 'Fantastique', 16: 'Animation', 18: 'Drame', 27: 'Horreur', 28: 'Action',
  35: 'Comédie', 36: 'Histoire', 37: 'Western', 53: 'Thriller', 80: 'Crime', 99: 'Documentaire',
  878: 'Science-fiction', 9648: 'Mystère', 10402: 'Musique', 10749: 'Romance', 10751: 'Famille',
  10752: 'Guerre', 10759: 'Action & aventure', 10762: 'Jeunesse', 10763: 'Actualités',
  10764: 'Télé-réalité', 10765: 'Science-fiction & fantastique', 10766: 'Feuilleton',
  10767: 'Talk-show', 10768: 'Guerre & politique',
};

export const TMDB_GENRES = Object.entries(GENRE_NAMES)
  .map(([id, name]) => ({ id: Number(id), name }))
  .sort((a, b) => a.name.localeCompare(b.name, 'fr'));

interface TmdbListItem {
  id: number;
  media_type?: 'movie' | 'tv' | 'person';
  title?: string;
  name?: string;
  original_title?: string;
  original_name?: string;
  overview?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  release_date?: string;
  first_air_date?: string;
  vote_average?: number;
  genre_ids?: number[];
  genres?: Array<{ id: number; name: string }>;
  adult?: boolean;
  popularity?: number;
}

interface TmdbPerson {
  id: number;
  name: string;
  character?: string;
  profile_path?: string | null;
  job?: string;
}

interface TmdbVideo {
  id: string;
  key: string;
  name: string;
  site: string;
  type: string;
  official?: boolean;
}

interface TmdbSeason {
  id: number;
  season_number: number;
  name: string;
  episode_count: number;
  air_date?: string | null;
  poster_path?: string | null;
}

interface TmdbDetails extends TmdbListItem {
  runtime?: number;
  episode_run_time?: number[];
  last_episode_to_air?: { runtime?: number } | null;
  original_title?: string;
  original_name?: string;
  status?: string;
  homepage?: string | null;
  production_countries?: Array<{ name: string }>;
  origin_country?: string[];
  production_companies?: Array<{ name: string }>;
  created_by?: Array<{ name: string }>;
  credits?: { cast?: TmdbPerson[]; crew?: TmdbPerson[] };
  videos?: { results?: TmdbVideo[] };
  recommendations?: { results?: TmdbListItem[] };
  similar?: { results?: TmdbListItem[] };
  release_dates?: { results?: Array<{ iso_3166_1: string; release_dates?: Array<{ certification?: string }> }> };
  content_ratings?: { results?: Array<{ iso_3166_1: string; rating?: string }> };
  seasons?: TmdbSeason[];
}

interface TmdbPage<T> { page: number; results: T[]; total_pages: number; total_results: number }

export class TmdbError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

function token() {
  const value = process.env.TMDB_API_READ_ACCESS_TOKEN;
  if (!value) throw new TmdbError('TMDB_API_READ_ACCESS_TOKEN is not configured', 503);
  return value;
}

async function tmdbFetch<T>(path: string, params: Record<string, string | number | boolean | undefined> = {}, revalidate = 1800): Promise<T> {
  const url = new URL(`${API_BASE}${path}`);
  url.searchParams.set('language', LANGUAGE);
  for (const [key, value] of Object.entries(params)) if (value !== undefined && value !== '') url.searchParams.set(key, String(value));
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token()}`, Accept: 'application/json' },
    next: { revalidate },
  });
  if (!response.ok) throw new TmdbError(`TMDB request failed (${response.status})`, response.status);
  const payload = await response.json();
  if (!payload || typeof payload !== 'object') throw new TmdbError('TMDB returned an invalid response', 502);
  return payload as T;
}

function image(path: string | null | undefined, size: 'w185' | 'w500' | 'w780' | 'original', fallback: string) {
  return path ? `${IMAGE_BASE}/${size}${path}` : fallback;
}

function inferMaturity(item: TmdbListItem) {
  if (item.adult) return 18;
  const genres = item.genre_ids ?? item.genres?.map((genre) => genre.id) ?? [];
  if (genres.includes(10751) || genres.includes(16) || genres.includes(10762)) return 7;
  return 13;
}

export function normalizeMedia(item: TmdbListItem, forcedType?: MediaType): ContentItem | null {
  const type = forcedType ?? (item.media_type === 'movie' || item.media_type === 'tv' ? item.media_type : null);
  if (!type || !Number.isInteger(item.id)) return null;
  const title = type === 'movie' ? item.title : item.name;
  if (!title) return null;
  const date = type === 'movie' ? item.release_date : item.first_air_date;
  return {
    id: makeMediaId(type, item.id), tmdbId: item.id, title,
    posterPath: image(item.poster_path, 'w500', '/assets/images/no_image.png'),
    backdropPath: image(item.backdrop_path, 'original', '/assets/images/no_image.png'),
    year: date ? Number(date.slice(0, 4)) || 0 : 0,
    rating: Number(item.vote_average ?? 0), mediaType: type,
    genres: item.genres?.map((genre) => genre.name) ?? (item.genre_ids ?? []).map((id) => GENRE_NAMES[id]).filter(Boolean),
    maturityLevel: inferMaturity(item), durationSeconds: 0,
    overview: item.overview || '',
  };
}

function normalizePage(page: TmdbPage<TmdbListItem>, forcedType?: MediaType): CatalogResult {
  return {
    items: page.results.map((item) => normalizeMedia(item, forcedType)).filter(Boolean) as ContentItem[],
    page: page.page, totalPages: Math.min(page.total_pages, 500), totalResults: page.total_results,
  };
}

function mergePages(pages: CatalogResult[], page: number): CatalogResult {
  const seen = new Set<string>();
  const items = pages.flatMap((result) => result.items).filter((item) => !seen.has(item.id) && seen.add(item.id));
  return { items: items.sort((a, b) => b.rating - a.rating), page, totalPages: Math.max(...pages.map((result) => result.totalPages)), totalResults: pages.reduce((sum, result) => sum + result.totalResults, 0) };
}

function applySearchFilters(result: CatalogResult, query: CatalogQuery): CatalogResult {
  let items = result.items;
  const genreName = query.genreId ? GENRE_NAMES[query.genreId] : undefined;
  if (genreName) items = items.filter((item) => item.genres.includes(genreName));
  if (query.year) items = items.filter((item) => item.year === query.year);
  if (query.minRating) items = items.filter((item) => item.rating >= query.minRating!);
  if (query.sort === 'rating') items = [...items].sort((a, b) => b.rating - a.rating);
  if (query.sort === 'newest') items = [...items].sort((a, b) => b.year - a.year);
  if (query.sort === 'oldest') items = [...items].sort((a, b) => a.year - b.year);
  if (query.sort === 'title') items = [...items].sort((a, b) => a.title.localeCompare(b.title, 'fr'));
  return { ...result, items, totalResults: items.length };
}

export async function getHomeSections(): Promise<HomeSections> {
  const [heroPage, trendingPage, moviesPage, seriesPage, nowMovies, onAirSeries, topMovies, topSeries] = await Promise.all([
    tmdbFetch<TmdbPage<TmdbListItem>>('/trending/all/week'), tmdbFetch<TmdbPage<TmdbListItem>>('/trending/all/day'),
    tmdbFetch<TmdbPage<TmdbListItem>>('/movie/popular'), tmdbFetch<TmdbPage<TmdbListItem>>('/tv/popular'),
    tmdbFetch<TmdbPage<TmdbListItem>>('/movie/now_playing', { region: 'FR' }), tmdbFetch<TmdbPage<TmdbListItem>>('/tv/on_the_air'),
    tmdbFetch<TmdbPage<TmdbListItem>>('/movie/top_rated'), tmdbFetch<TmdbPage<TmdbListItem>>('/tv/top_rated'),
  ]);
  const normalize = (page: TmdbPage<TmdbListItem>, type?: MediaType) => normalizePage(page, type).items;
  return {
    hero: normalize(heroPage).filter((item) => item.backdropPath.includes('image.tmdb.org') && item.overview).slice(0, 5),
    trending: normalize(trendingPage), popularMovies: normalize(moviesPage, 'movie'), popularSeries: normalize(seriesPage, 'tv'),
    newReleases: [...normalize(nowMovies, 'movie'), ...normalize(onAirSeries, 'tv')].sort((a, b) => b.year - a.year).slice(0, 20),
    topRated: [...normalize(topMovies, 'movie'), ...normalize(topSeries, 'tv')].sort((a, b) => b.rating - a.rating).slice(0, 20),
  };
}

async function catalogForType(type: MediaType, query: CatalogQuery): Promise<CatalogResult> {
  const page = query.page ?? 1;
  if (query.query) {
    const result = await tmdbFetch<TmdbPage<TmdbListItem>>(`/search/${type}`, { query: query.query, page, include_adult: false }, 300);
    return applySearchFilters(normalizePage(result, type), query);
  }
  if (query.category === 'trending') return normalizePage(await tmdbFetch<TmdbPage<TmdbListItem>>(`/trending/${type}/week`, { page }, 900), type);
  if (query.category === 'top-rated') return normalizePage(await tmdbFetch<TmdbPage<TmdbListItem>>(`/${type}/top_rated`, { page }), type);
  if (query.category === 'new') return normalizePage(await tmdbFetch<TmdbPage<TmdbListItem>>(type === 'movie' ? '/movie/now_playing' : '/tv/on_the_air', { page, region: type === 'movie' ? 'FR' : undefined }, 900), type);
  const sortBy = query.sort === 'rating' ? 'vote_average.desc' : query.sort === 'newest' ? (type === 'movie' ? 'primary_release_date.desc' : 'first_air_date.desc') : query.sort === 'oldest' ? (type === 'movie' ? 'primary_release_date.asc' : 'first_air_date.asc') : query.sort === 'title' ? (type === 'movie' ? 'original_title.asc' : 'name.asc') : 'popularity.desc';
  const params: Record<string, string | number | boolean | undefined> = { page, include_adult: false, sort_by: sortBy, with_genres: query.genreId, 'vote_average.gte': query.minRating, 'vote_count.gte': query.minRating ? 100 : undefined };
  if (query.year) params[type === 'movie' ? 'primary_release_year' : 'first_air_date_year'] = query.year;
  return normalizePage(await tmdbFetch<TmdbPage<TmdbListItem>>(`/discover/${type}`, params, 900), type);
}

export async function getCatalog(query: CatalogQuery): Promise<CatalogResult> {
  if (query.mediaType === 'movie' || query.mediaType === 'tv') return catalogForType(query.mediaType, query);
  if (query.query) return applySearchFilters(normalizePage(await tmdbFetch<TmdbPage<TmdbListItem>>('/search/multi', { query: query.query, page: query.page ?? 1, include_adult: false }, 300)), query);
  const [movies, series] = await Promise.all([catalogForType('movie', query), catalogForType('tv', query)]);
  return mergePages([movies, series], query.page ?? 1);
}

export async function getMediaSummaries(ids: string[]) {
  const parsed = ids.map(parseMediaId).filter(Boolean) as Array<{ mediaType: MediaType; tmdbId: number }>;
  const results = await Promise.all(parsed.slice(0, 50).map(async ({ mediaType, tmdbId }) => {
    try { return normalizeMedia(await tmdbFetch<TmdbListItem>(`/${mediaType}/${tmdbId}`, {}, 3600), mediaType); }
    catch { return null; }
  }));
  return results.filter(Boolean) as ContentItem[];
}

function certification(details: TmdbDetails, type: MediaType) {
  if (type === 'movie') {
    const country = details.release_dates?.results?.find((item) => item.iso_3166_1 === 'FR') ?? details.release_dates?.results?.find((item) => item.iso_3166_1 === 'US');
    const value = country?.release_dates?.find((item) => item.certification)?.certification;
    const number = Number(String(value ?? '').replace(/\D/g, ''));
    return number || inferMaturity(details);
  }
  const value = details.content_ratings?.results?.find((item) => item.iso_3166_1 === 'FR')?.rating ?? details.content_ratings?.results?.find((item) => item.iso_3166_1 === 'US')?.rating;
  const number = Number(String(value ?? '').replace(/\D/g, ''));
  if (/TV-MA/i.test(value ?? '')) return 18;
  return number || inferMaturity(details);
}

export async function getMediaDetails(type: MediaType, id: number): Promise<MediaDetails> {
  const append = type === 'movie' ? 'credits,videos,recommendations,similar,release_dates' : 'credits,videos,recommendations,similar,content_ratings';
  const details = await tmdbFetch<TmdbDetails>(`/${type}/${id}`, { append_to_response: append }, 1800);
  const base = normalizeMedia(details, type);
  if (!base) throw new TmdbError('TMDB media not found', 404);
  const runtime = type === 'movie' ? details.runtime ?? 0 : details.episode_run_time?.[0] ?? details.last_episode_to_air?.runtime ?? 0;
  const videos = (details.videos?.results ?? []).filter((video) => (video.site === 'YouTube' || video.site === 'Vimeo') && (video.type === 'Trailer' || video.type === 'Teaser'));
  const recommended = (details.recommendations?.results ?? []).map((item: TmdbListItem) => normalizeMedia(item, type)).filter(Boolean);
  const similar = (details.similar?.results ?? []).map((item: TmdbListItem) => normalizeMedia(item, type)).filter(Boolean);
  return {
    ...base, maturityLevel: certification(details, type), durationSeconds: runtime * 60,
    originalTitle: type === 'movie' ? details.original_title ?? base.title : details.original_name ?? base.title,
    overview: details.overview || '', runtimeMinutes: runtime, status: details.status || '',
    country: details.production_countries?.[0]?.name ?? details.origin_country?.[0] ?? '',
    productionCompanies: (details.production_companies ?? []).map((company) => company.name).filter(Boolean),
    creators: type === 'movie' ? (details.credits?.crew ?? []).filter((person) => person.job === 'Director').map((person) => person.name) : (details.created_by ?? []).map((person) => person.name),
    cast: (details.credits?.cast ?? []).slice(0, 12).map((person) => ({ id: person.id, name: person.name, character: person.character || '', profilePath: image(person.profile_path, 'w185', '/assets/images/no_image.png') })),
    trailers: videos.map((video): TrailerVideo => ({ id: video.id, key: video.key, name: video.name, site: video.site as TrailerVideo['site'], type: video.type, official: Boolean(video.official) })),
    recommendations: recommended.slice(0, 12), similar: similar.slice(0, 12),
    seasons: type === 'tv' ? (details.seasons ?? []).filter((season) => season.season_number > 0).map((season) => ({ id: season.id, seasonNumber: season.season_number, name: season.name, episodeCount: season.episode_count, airDate: season.air_date ?? null, posterPath: image(season.poster_path, 'w500', '/assets/images/no_image.png') })) : [],
    homepage: details.homepage || null,
  };
}

const GENRE_IDS: Record<string, number> = Object.fromEntries(Object.entries(GENRE_NAMES).map(([id, name]) => [name, Number(id)]));

export async function getProfileRecommendations(profile: CineverseProfile) {
  const preferredGenres = profile.preferences.map((name) => GENRE_IDS[name]).filter(Boolean).slice(0, 3);
  const excluded = new Set([...profile.watchlist, ...profile.favorites, ...profile.history.map((item) => item.mediaId)]);
  const catalogs = preferredGenres.length
    ? await Promise.all(preferredGenres.map((genreId) => getCatalog({ mediaType: 'all', category: 'popular', genreId, page: 1 })))
    : [await getCatalog({ mediaType: 'all', category: 'popular', page: 1 })];
  const seen = new Set<string>();
  return catalogs
    .flatMap((result) => result.items)
    .filter((item) => !seen.has(item.id) && seen.add(item.id))
    .filter((item) => !excluded.has(item.id) && item.maturityLevel <= profile.maturityLevel)
    .sort((a, b) => {
      const aMatches = a.genres.filter((genre) => profile.preferences.includes(genre)).length;
      const bMatches = b.genres.filter((genre) => profile.preferences.includes(genre)).length;
      return bMatches - aMatches || b.rating - a.rating;
    })
    .slice(0, 12);
}
