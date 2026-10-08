'use client';
import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import AppImage from '@/components/ui/AppImage';
import { Search, Star, ChevronDown, Filter } from 'lucide-react';

// Backend integration point: replace ALL_MOVIES with TMDB API paginated fetch
const ALL_MOVIES = [
  { id: 'cat-dune2', title: 'Dune: Part Two', posterPath: 'https://image.tmdb.org/t/p/w500/1pdfLvkbY9ohJlCjQH2CZjjYVvJ.jpg', year: 2024, rating: 8.5, genre: 'Science-fiction', country: 'États-Unis', mediaType: 'film' as const },
  { id: 'cat-last-of-us', title: 'The Last of Us', posterPath: 'https://image.tmdb.org/t/p/w500/uKvVjHNqB5VmOrdxqAt2F7J78ED.jpg', year: 2023, rating: 8.8, genre: 'Drame', country: 'États-Unis', mediaType: 'serie' as const },
  { id: 'cat-joker2', title: 'Joker: Folie à Deux', posterPath: 'https://image.tmdb.org/t/p/w500/dCn8GCF6OFwOQ9MzSBEcGsBJSEP.jpg', year: 2024, rating: 8.1, genre: 'Thriller', country: 'États-Unis', mediaType: 'film' as const },
  { id: 'cat-house-dragon', title: 'House of the Dragon', posterPath: 'https://image.tmdb.org/t/p/w500/z2yahl2uefxDCl0nogcRBstwruJ.jpg', year: 2022, rating: 8.4, genre: 'Fantastique', country: 'États-Unis', mediaType: 'serie' as const },
  { id: 'cat-interstellar', title: 'Interstellar', posterPath: 'https://image.tmdb.org/t/p/w500/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg', year: 2014, rating: 8.6, genre: 'Science-fiction', country: 'États-Unis', mediaType: 'film' as const },
  { id: 'cat-oppenheimer', title: 'Oppenheimer', posterPath: 'https://image.tmdb.org/t/p/w500/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg', year: 2023, rating: 8.5, genre: 'Biographie', country: 'États-Unis', mediaType: 'film' as const },
  { id: 'cat-stranger-things', title: 'Stranger Things', posterPath: 'https://image.tmdb.org/t/p/w500/49WJfeN0moxb9IPfGn8AIqMGskD.jpg', year: 2016, rating: 8.7, genre: 'Science-fiction', country: 'États-Unis', mediaType: 'serie' as const },
  { id: 'cat-boys', title: 'The Boys', posterPath: 'https://image.tmdb.org/t/p/w500/stTEycfG9928HYGEISBFaG1ngjM.jpg', year: 2019, rating: 8.4, genre: 'Action', country: 'États-Unis', mediaType: 'serie' as const },
  { id: 'cat-deadpool', title: 'Deadpool & Wolverine', posterPath: 'https://image.tmdb.org/t/p/w500/8cdWjvZQUExUUTzyp4t6EDMubfO.jpg', year: 2024, rating: 7.9, genre: 'Action', country: 'États-Unis', mediaType: 'film' as const },
  { id: 'cat-fallout', title: 'Fallout', posterPath: 'https://image.tmdb.org/t/p/w500/AnsSKR9dn5LVzPFvxAoKJvwPLYF.jpg', year: 2024, rating: 8.5, genre: 'Science-fiction', country: 'États-Unis', mediaType: 'serie' as const },
  { id: 'cat-breaking-bad', title: 'Breaking Bad', posterPath: 'https://image.tmdb.org/t/p/w500/ggFHVNu6YYI5L9pCfOacjizRGt.jpg', year: 2008, rating: 9.5, genre: 'Crime', country: 'États-Unis', mediaType: 'serie' as const },
  { id: 'cat-dark-knight', title: 'The Dark Knight', posterPath: 'https://image.tmdb.org/t/p/w500/qJ2tW6WMUDux911r6m7haRef0WH.jpg', year: 2008, rating: 9.0, genre: 'Action', country: 'États-Unis', mediaType: 'film' as const },
  { id: 'cat-inception', title: 'Inception', posterPath: 'https://image.tmdb.org/t/p/w500/oYuLEt3zVCKq57qu2F8dT7NIa6f.jpg', year: 2010, rating: 8.8, genre: 'Science-fiction', country: 'États-Unis', mediaType: 'film' as const },
  { id: 'cat-parasite', title: 'Parasite', posterPath: 'https://image.tmdb.org/t/p/w500/7IiTTgloJzvGI1TAYymCfbfl3vT.jpg', year: 2019, rating: 8.5, genre: 'Thriller', country: 'Corée du Sud', mediaType: 'film' as const },
  { id: 'cat-peaky', title: 'Peaky Blinders', posterPath: 'https://image.tmdb.org/t/p/w500/vUUqzWa2LnHIVqkaKVn3nyfVsa0.jpg', year: 2013, rating: 8.8, genre: 'Crime', country: 'Royaume-Uni', mediaType: 'serie' as const },
  { id: 'cat-chernobyl', title: 'Chernobyl', posterPath: 'https://image.tmdb.org/t/p/w500/hlLXt2tOPT6RRnjiUmoxyG1LTFi.jpg', year: 2019, rating: 9.4, genre: 'Drame', country: 'Royaume-Uni', mediaType: 'serie' as const },
  { id: 'cat-game-thrones', title: 'Game of Thrones', posterPath: 'https://image.tmdb.org/t/p/w500/1XS1oqL89opfnbLl8WnZY1O1uJx.jpg', year: 2011, rating: 9.2, genre: 'Fantastique', country: 'États-Unis', mediaType: 'serie' as const },
  { id: 'cat-shawshank', title: 'Les Évadés', posterPath: 'https://image.tmdb.org/t/p/w500/q6y0Go1tsGEsmtFryDOJo3dEmqu.jpg', year: 1994, rating: 9.3, genre: 'Drame', country: 'États-Unis', mediaType: 'film' as const },
  { id: 'cat-dark', title: 'Dark', posterPath: 'https://image.tmdb.org/t/p/w500/apbrbWs8M9lyOpJYU5WXrpFbk1Z.jpg', year: 2017, rating: 8.8, genre: 'Science-fiction', country: 'Allemagne', mediaType: 'serie' as const },
  { id: 'cat-arrival', title: 'Premier Contact', posterPath: 'https://image.tmdb.org/t/p/w500/x2FJsf1ElAgr63Y3PNPtJrcmpoe.jpg', year: 2016, rating: 8.0, genre: 'Science-fiction', country: 'États-Unis', mediaType: 'film' as const },
  { id: 'cat-succession', title: 'Succession', posterPath: 'https://image.tmdb.org/t/p/w500/e2X4vnHC4En4ESJJEQogGDlzQ9S.jpg', year: 2018, rating: 8.9, genre: 'Drame', country: 'États-Unis', mediaType: 'serie' as const },
  { id: 'cat-blade-runner', title: 'Blade Runner 2049', posterPath: 'https://image.tmdb.org/t/p/w500/gajva2L0rPYkEWjzgFlBXCAVBE5.jpg', year: 2017, rating: 8.0, genre: 'Science-fiction', country: 'États-Unis', mediaType: 'film' as const },
  { id: 'cat-true-detective', title: 'True Detective', posterPath: 'https://image.tmdb.org/t/p/w500/nVRyd8hlg0ZLxBn9RaI7mUMQLnz.jpg', year: 2014, rating: 9.0, genre: 'Crime', country: 'États-Unis', mediaType: 'serie' as const },
  { id: 'cat-furiosa', title: 'Furiosa', posterPath: 'https://image.tmdb.org/t/p/w500/iADOJ8Zymht2JPMoy3R7xceZprc.jpg', year: 2024, rating: 7.7, genre: 'Action', country: 'Australie', mediaType: 'film' as const },
];

const TABS = [
  { id: 'tous', label: 'Tous' },
  { id: 'films', label: 'Films' },
  { id: 'series', label: 'Séries' },
  { id: 'nouveautes', label: 'Nouveautés' },
  { id: 'tendances', label: 'Tendances' },
  { id: 'top', label: 'Les mieux notés' },
];

const GENRES = ['Tous les genres', 'Action', 'Biographie', 'Crime', 'Drame', 'Fantastique', 'Science-fiction', 'Thriller'];
const YEARS = ['Toutes les années', '2024', '2023', '2022', '2021', '2020', '2019', '2010-2018', 'Avant 2010'];
const COUNTRIES = ['Tous les pays', 'États-Unis', 'Royaume-Uni', 'France', 'Corée du Sud', 'Allemagne', 'Australie'];
const RATINGS = ['Toutes les notes', '9+', '8+', '7+', '6+'];
const SORT_OPTIONS = ['Popularité', 'Note', 'Année (récent)', 'Année (ancien)', 'Titre A-Z'];

export default function CatalogContent() {
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('tous');
  const [genre, setGenre] = useState('Tous les genres');
  const [year, setYear] = useState('Toutes les années');
  const [country, setCountry] = useState('Tous les pays');
  const [rating, setRating] = useState('Toutes les notes');
  const [sort, setSort] = useState('Popularité');
  const [page, setPage] = useState(1);
  const PER_PAGE = 12;

  const filtered = useMemo(() => {
    let results = [...ALL_MOVIES];

    if (search.trim()) {
      const q = search.toLowerCase();
      results = results.filter((m) => m.title.toLowerCase().includes(q));
    }

    if (activeTab === 'films') results = results.filter((m) => m.mediaType === 'film');
    if (activeTab === 'series') results = results.filter((m) => m.mediaType === 'serie');
    if (activeTab === 'nouveautes') results = results.filter((m) => m.year >= 2024);
    if (activeTab === 'tendances') results = results.filter((m) => m.rating >= 8.4);
    if (activeTab === 'top') results = results.sort((a, b) => b.rating - a.rating);

    if (genre !== 'Tous les genres') results = results.filter((m) => m.genre === genre);
    if (country !== 'Tous les pays') results = results.filter((m) => m.country === country);

    if (rating === '9+') results = results.filter((m) => m.rating >= 9);
    else if (rating === '8+') results = results.filter((m) => m.rating >= 8);
    else if (rating === '7+') results = results.filter((m) => m.rating >= 7);
    else if (rating === '6+') results = results.filter((m) => m.rating >= 6);

    if (year !== 'Toutes les années') {
      if (year === '2010-2018') results = results.filter((m) => m.year >= 2010 && m.year <= 2018);
      else if (year === 'Avant 2010') results = results.filter((m) => m.year < 2010);
      else results = results.filter((m) => m.year === parseInt(year));
    }

    if (sort === 'Note') results = [...results].sort((a, b) => b.rating - a.rating);
    else if (sort === 'Année (récent)') results = [...results].sort((a, b) => b.year - a.year);
    else if (sort === 'Année (ancien)') results = [...results].sort((a, b) => a.year - b.year);
    else if (sort === 'Titre A-Z') results = [...results].sort((a, b) => a.title.localeCompare(b.title));

    return results;
  }, [search, activeTab, genre, year, country, rating, sort]);

  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const paginated = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    setPage(1);
  };

  return (
    <div className="max-w-screen-2xl mx-auto px-4 lg:px-8 xl:px-10">
      {/* Heading */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Films & Séries</h1>
        <p className="text-muted-foreground">Découvrez des milliers de films et séries en streaming</p>
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Rechercher un film, une série, un acteur..."
          className="search-input pl-12 w-full"
        />
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 mb-6 overflow-x-auto scrollbar-hide pb-1">
        {TABS.map((tab) => (
          <button
            key={`tab-${tab.id}`}
            onClick={() => handleTabChange(tab.id)}
            className={`shrink-0 px-4 py-2 rounded-full text-sm font-semibold transition-all duration-200 ${
              activeTab === tab.id
                ? 'bg-primary text-white' :'bg-card border border-border text-muted-foreground hover:text-white hover:border-white/30'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-8">
        <Filter size={16} className="text-muted-foreground shrink-0" />
        {[
          { label: 'Genres', value: genre, options: GENRES, setter: setGenre },
          { label: 'Année', value: year, options: YEARS, setter: setYear },
          { label: 'Pays', value: country, options: COUNTRIES, setter: setCountry },
          { label: 'Note', value: rating, options: RATINGS, setter: setRating },
          { label: 'Trier par', value: sort, options: SORT_OPTIONS, setter: setSort },
        ].map((filter) => (
          <div key={`filter-${filter.label}`} className="relative">
            <select
              value={filter.value}
              onChange={(e) => { filter.setter(e.target.value); setPage(1); }}
              className="filter-select pr-8 appearance-none"
            >
              {filter.options.map((opt) => (
                <option key={`opt-${filter.label}-${opt}`} value={opt} className="bg-card text-white">
                  {opt}
                </option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          </div>
        ))}
        <span className="text-sm text-muted-foreground ml-auto">
          {filtered.length} résultat{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Grid */}
      {paginated.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 rounded-full bg-card border border-border flex items-center justify-center mb-4">
            <Search size={28} className="text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">Aucun résultat trouvé</h3>
          <p className="text-muted-foreground text-sm max-w-xs">
            Essayez d'autres termes de recherche ou ajustez vos filtres pour trouver ce que vous cherchez.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8 gap-3 mb-8">
          {paginated.map((movie) => (
            <CatalogCard key={movie.id} movie={movie} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 py-8">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-4 py-2 rounded-lg bg-card border border-border text-sm text-muted-foreground hover:text-white hover:border-white/30 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            Précédent
          </button>
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
            .map((p, idx, arr) => {
              const prev = arr[idx - 1];
              return (
                <React.Fragment key={`page-${p}`}>
                  {prev && p - prev > 1 && (
                    <span className="text-muted-foreground px-1">…</span>
                  )}
                  <button
                    onClick={() => setPage(p)}
                    className={`w-9 h-9 rounded-lg text-sm font-semibold transition-all ${
                      p === page
                        ? 'bg-primary text-white' :'bg-card border border-border text-muted-foreground hover:text-white hover:border-white/30'
                    }`}
                  >
                    {p}
                  </button>
                </React.Fragment>
              );
            })}
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-4 py-2 rounded-lg bg-card border border-border text-sm text-muted-foreground hover:text-white hover:border-white/30 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            Suivant
          </button>
        </div>
      )}
    </div>
  );
}

function CatalogCard({ movie }: { movie: typeof ALL_MOVIES[0] }) {
  const [hovered, setHovered] = useState(false);

  return (
    <Link href={`/movie-series-detail?id=${movie.id}`} className="block group">
      <div
        className="relative rounded-lg overflow-hidden bg-card cursor-pointer transition-transform duration-300 hover:scale-105 hover:z-10 poster-shadow"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <div className="relative aspect-[2/3]">
          <AppImage
            src={movie.posterPath}
            alt={`Affiche de ${movie.title}`}
            fill
            sizes="(max-width: 640px) 33vw, (max-width: 1024px) 20vw, 12vw"
            className="object-cover"
            unoptimized
          />
          {movie.mediaType === 'serie' && (
            <span className="absolute top-1.5 right-1.5 text-xs font-bold px-1.5 py-0.5 rounded bg-primary/90 text-white">
              Série
            </span>
          )}
          <div className={`absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-transparent transition-opacity duration-300 ${hovered ? 'opacity-100' : 'opacity-0'}`} />
          {hovered && (
            <div className="absolute bottom-2 left-2 right-2">
              <p className="text-xs font-semibold text-white truncate mb-1">{movie.title}</p>
              <div className="flex items-center gap-1">
                <Star size={10} fill="#F5B301" className="text-rating shrink-0" />
                <span className="text-xs text-rating font-semibold">{movie.rating.toFixed(1)}</span>
                <span className="text-xs text-white/60 ml-1">{movie.year}</span>
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="mt-1.5 px-0.5">
        <p className="text-xs font-medium text-white/80 truncate leading-tight">{movie.title}</p>
        <div className="flex items-center gap-1 mt-0.5">
          <Star size={9} fill="#F5B301" className="text-rating shrink-0" />
          <span className="text-xs text-rating font-semibold">{movie.rating.toFixed(1)}</span>
          <span className="text-xs text-muted-foreground">{movie.year}</span>
        </div>
      </div>
    </Link>
  );
}