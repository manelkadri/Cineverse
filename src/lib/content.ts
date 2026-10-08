import type { CineverseProfile, ContentItem } from './profile-types';

export const CONTENT_CATALOG: ContentItem[] = [
  { id: 'dune-part-two', tmdbId: 693134, title: 'Dune : Deuxième partie', posterPath: 'https://image.tmdb.org/t/p/w500/1pdfLvkbY9ohJlCjQH2CZjjYVvJ.jpg', backdropPath: '/assets/images/heroes/dune-part-two-v2.png', year: 2024, rating: 8.5, mediaType: 'film', genres: ['Science-fiction', 'Aventure'], maturityLevel: 13, durationSeconds: 9960 },
  { id: 'the-last-of-us', tmdbId: 100088, title: 'The Last of Us', posterPath: 'https://image.tmdb.org/t/p/w500/uKvVjHNqB5VmOrdxqAt2F7J78ED.jpg', backdropPath: '/assets/images/heroes/the-last-of-us-v2.png', year: 2023, rating: 8.8, mediaType: 'serie', genres: ['Drame', 'Science-fiction'], maturityLevel: 16, durationSeconds: 4860 },
  { id: 'oppenheimer', tmdbId: 872585, title: 'Oppenheimer', posterPath: 'https://image.tmdb.org/t/p/w500/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg', backdropPath: '/assets/images/heroes/oppenheimer-v2.png', year: 2023, rating: 8.5, mediaType: 'film', genres: ['Drame', 'Histoire'], maturityLevel: 13, durationSeconds: 10800 },
  { id: 'breaking-bad', tmdbId: 1396, title: 'Breaking Bad', posterPath: 'https://image.tmdb.org/t/p/w500/ggFHVNu6YYI5L9pCfOacjizRGt.jpg', backdropPath: '/assets/images/heroes/breaking-bad-v2.png', year: 2008, rating: 9.5, mediaType: 'serie', genres: ['Crime', 'Drame'], maturityLevel: 18, durationSeconds: 2820 },
  { id: 'interstellar', tmdbId: 157336, title: 'Interstellar', posterPath: 'https://image.tmdb.org/t/p/w500/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg', backdropPath: 'https://image.tmdb.org/t/p/original/xJHokMbljvjADYdit5fK5VQsXEG.jpg', year: 2014, rating: 8.6, mediaType: 'film', genres: ['Science-fiction', 'Drame'], maturityLevel: 10, durationSeconds: 10140 },
  { id: 'stranger-things', tmdbId: 66732, title: 'Stranger Things', posterPath: 'https://image.tmdb.org/t/p/w500/49WJfeN0moxb9IPfGn8AIqMGskD.jpg', backdropPath: 'https://image.tmdb.org/t/p/original/56v2KjBlU4XaOv9rVYEQypROD7P.jpg', year: 2016, rating: 8.7, mediaType: 'serie', genres: ['Science-fiction', 'Fantastique'], maturityLevel: 13, durationSeconds: 3900 },
  { id: 'house-of-the-dragon', tmdbId: 94997, title: 'House of the Dragon', posterPath: 'https://image.tmdb.org/t/p/w500/z2yahl2uefxDCl0nogcRBstwruJ.jpg', backdropPath: 'https://image.tmdb.org/t/p/original/etj8E2o0Bud0HkONVQPjyCkIvpv.jpg', year: 2022, rating: 8.4, mediaType: 'serie', genres: ['Fantastique', 'Drame'], maturityLevel: 16, durationSeconds: 3900 },
  { id: 'the-boys', tmdbId: 76479, title: 'The Boys', posterPath: 'https://image.tmdb.org/t/p/w500/stTEycfG9928HYGEISBFaG1ngjM.jpg', backdropPath: 'https://image.tmdb.org/t/p/original/7PRddO7z7mcPi21nZTCMGShAyy1.jpg', year: 2019, rating: 8.4, mediaType: 'serie', genres: ['Action', 'Science-fiction'], maturityLevel: 18, durationSeconds: 3600 },
  { id: 'joker-folie-a-deux', tmdbId: 889737, title: 'Joker : Folie à Deux', posterPath: 'https://image.tmdb.org/t/p/w500/dCn8GCF6OFwOQ9MzSBEcGsBJSEP.jpg', backdropPath: 'https://image.tmdb.org/t/p/original/uGmYqxh8flqkudioyFtD7IJSHxK.jpg', year: 2024, rating: 6.0, mediaType: 'film', genres: ['Drame', 'Thriller'], maturityLevel: 16, durationSeconds: 8280 },
  { id: 'inside-out-2', tmdbId: 1022789, title: 'Vice-Versa 2', posterPath: 'https://image.tmdb.org/t/p/w500/vpnVM9B6NMmQpWeZvzLvDESb2QY.jpg', backdropPath: 'https://image.tmdb.org/t/p/original/p5ozvmdgsmbWe0H8Xk7Rc8SCwAB.jpg', year: 2024, rating: 7.7, mediaType: 'film', genres: ['Animation', 'Famille'], maturityLevel: 7, durationSeconds: 5760 },
  { id: 'the-mandalorian', tmdbId: 82856, title: 'The Mandalorian', posterPath: 'https://image.tmdb.org/t/p/w500/eU1i6eHXlzMqZiiTPwGnhagebIE.jpg', backdropPath: 'https://image.tmdb.org/t/p/original/9ijMGlJKqcslswWUzTEwScm82Gs.jpg', year: 2019, rating: 8.5, mediaType: 'serie', genres: ['Aventure', 'Famille'], maturityLevel: 10, durationSeconds: 2700 },
  { id: 'inception', tmdbId: 27205, title: 'Inception', posterPath: 'https://image.tmdb.org/t/p/w500/oYuLEt3zVCKq57qu2F8dT7NIa6f.jpg', backdropPath: 'https://image.tmdb.org/t/p/original/s3TBrRGB1iav7gFOCNx3H31MoES.jpg', year: 2010, rating: 8.8, mediaType: 'film', genres: ['Science-fiction', 'Thriller'], maturityLevel: 13, durationSeconds: 8880 },
  { id: 'arrival', tmdbId: 329865, title: 'Premier Contact', posterPath: 'https://image.tmdb.org/t/p/w500/x2FJsf1ElAgr63Y3PNPtJrcmpoe.jpg', backdropPath: 'https://image.tmdb.org/t/p/original/x2FJsf1ElAgr63Y3PNPtJrcmpoe.jpg', year: 2016, rating: 8.0, mediaType: 'film', genres: ['Science-fiction', 'Drame'], maturityLevel: 10, durationSeconds: 6960 },
  { id: 'fallout', tmdbId: 106379, title: 'Fallout', posterPath: 'https://image.tmdb.org/t/p/w500/AnsSKR9dn5LVzPFvxAoKJvwPLYF.jpg', backdropPath: 'https://image.tmdb.org/t/p/original/4rqKrwMhB9O0I9b9ZVDNm7GeZ4B.jpg', year: 2024, rating: 8.5, mediaType: 'serie', genres: ['Science-fiction', 'Action'], maturityLevel: 16, durationSeconds: 3660 },
  { id: 'dark', tmdbId: 70523, title: 'Dark', posterPath: 'https://image.tmdb.org/t/p/w500/apbrbWs8M9lyOpJYU5WXrpFbk1Z.jpg', backdropPath: 'https://image.tmdb.org/t/p/original/3lBDg3i6nn5R2NKFCJ6oKyUo2j5.jpg', year: 2017, rating: 8.8, mediaType: 'serie', genres: ['Science-fiction', 'Mystère'], maturityLevel: 16, durationSeconds: 3600 },
  { id: 'paddington-2', tmdbId: 346648, title: 'Paddington 2', posterPath: 'https://image.tmdb.org/t/p/w500/1OJ9vkD5xPt3skC6KguyXAgagRZ.jpg', backdropPath: 'https://image.tmdb.org/t/p/original/AfyuI3glMCBDFmNPj9PY6DwbgGp.jpg', year: 2017, rating: 7.9, mediaType: 'film', genres: ['Famille', 'Aventure'], maturityLevel: 7, durationSeconds: 6240 },
];

export function getContent(ids: string[], profile?: CineverseProfile | null) {
  const allowed = CONTENT_CATALOG.filter((item) => !profile || item.maturityLevel <= profile.maturityLevel);
  return ids.map((id) => allowed.find((item) => item.id === id)).filter(Boolean) as ContentItem[];
}

export function getRecommendations(profile: CineverseProfile | null, limit = 10) {
  if (!profile) return CONTENT_CATALOG.slice(0, limit);
  const excluded = new Set([...profile.watchlist, ...profile.favorites, ...profile.history.map((item) => item.mediaId)]);
  return CONTENT_CATALOG
    .filter((item) => item.maturityLevel <= profile.maturityLevel && !excluded.has(item.id))
    .map((item) => ({
      item,
      score: item.genres.reduce((score, genre) => score + (profile.preferences.includes(genre) ? 3 : 0), item.rating),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ item }) => item);
}
