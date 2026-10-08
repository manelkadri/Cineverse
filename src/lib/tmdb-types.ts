import type { ContentItem, MediaType } from './profile-types';

export interface HomeSections {
  hero: ContentItem[];
  trending: ContentItem[];
  popularMovies: ContentItem[];
  popularSeries: ContentItem[];
  newReleases: ContentItem[];
  topRated: ContentItem[];
}

export interface CatalogResult {
  items: ContentItem[];
  page: number;
  totalPages: number;
  totalResults: number;
}

export interface CastMember {
  id: number;
  name: string;
  character: string;
  profilePath: string;
}

export interface TrailerVideo {
  id: string;
  key: string;
  name: string;
  site: 'YouTube' | 'Vimeo';
  type: string;
  official: boolean;
}

export interface SeasonSummary {
  id: number;
  seasonNumber: number;
  name: string;
  episodeCount: number;
  airDate: string | null;
  posterPath: string;
}

export interface MediaDetails extends ContentItem {
  originalTitle: string;
  overview: string;
  runtimeMinutes: number;
  status: string;
  country: string;
  productionCompanies: string[];
  creators: string[];
  cast: CastMember[];
  trailers: TrailerVideo[];
  similar: ContentItem[];
  recommendations: ContentItem[];
  seasons: SeasonSummary[];
  homepage: string | null;
}

export interface CatalogQuery {
  query?: string;
  mediaType?: 'all' | MediaType;
  category?: 'popular' | 'trending' | 'top-rated' | 'new';
  genreId?: number;
  year?: number;
  minRating?: number;
  sort?: 'popularity' | 'rating' | 'newest' | 'oldest' | 'title';
  page?: number;
}
