'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronLeft, ChevronRight, Filter, RefreshCw, Search, ShieldCheck } from 'lucide-react';
import MovieCard from '@/components/MovieCard';
import { useProfiles } from '@/context/ProfileContext';
import type { CatalogResult } from '@/lib/tmdb-types';
import type { MediaType } from '@/lib/profile-types';
import { useSearchParams } from 'next/navigation';

const GENRES = [
  { id: 28, name: 'Action' }, { id: 12, name: 'Aventure' }, { id: 16, name: 'Animation' },
  { id: 35, name: 'Comédie' }, { id: 80, name: 'Crime' }, { id: 99, name: 'Documentaire' },
  { id: 18, name: 'Drame' }, { id: 10751, name: 'Famille' }, { id: 14, name: 'Fantastique' },
  { id: 36, name: 'Histoire' }, { id: 27, name: 'Horreur' }, { id: 9648, name: 'Mystère' },
  { id: 10749, name: 'Romance' }, { id: 878, name: 'Science-fiction' }, { id: 53, name: 'Thriller' },
];

type Category = 'popular' | 'trending' | 'top-rated' | 'new';
type Sort = 'popularity' | 'rating' | 'newest' | 'oldest' | 'title';
const MEDIA_TABS: Array<{ id: 'all' | MediaType; label: string }> = [{ id: 'all', label: 'Tous' }, { id: 'movie', label: 'Films' }, { id: 'tv', label: 'Séries' }];
const CATEGORY_TABS: Array<{ id: Category; label: string }> = [{ id: 'popular', label: 'Populaires' }, { id: 'trending', label: 'Tendances' }, { id: 'new', label: 'Nouveautés' }, { id: 'top-rated', label: 'Les mieux notés' }];

export default function CatalogContent() {
  const { selectedProfile } = useProfiles();
  const routeParams = useSearchParams();
  const initialType = routeParams.get('type');
  const initialQuery = routeParams.get('q') ?? '';
  const [search, setSearch] = useState(initialQuery);
  const [debouncedSearch, setDebouncedSearch] = useState(initialQuery);
  const [mediaType, setMediaType] = useState<'all' | MediaType>(initialType === 'movie' || initialType === 'tv' ? initialType : 'all');
  const [category, setCategory] = useState<Category>('popular');
  const [genre, setGenre] = useState('');
  const [year, setYear] = useState('');
  const [rating, setRating] = useState('');
  const [sort, setSort] = useState<Sort>('popularity');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<CatalogResult>({ items: [], page: 1, totalPages: 1, totalResults: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const nextType = routeParams.get('type');
    const nextQuery = routeParams.get('q') ?? '';
    setMediaType(nextType === 'movie' || nextType === 'tv' ? nextType : 'all');
    setSearch(nextQuery);
    setDebouncedSearch(nextQuery);
    setPage(1);
  }, [routeParams]);

  useEffect(() => { const timer = window.setTimeout(() => { setDebouncedSearch(search.trim()); setPage(1); }, 400); return () => window.clearTimeout(timer); }, [search]);

  const requestUrl = useMemo(() => {
    const params = new URLSearchParams({ type: mediaType, category, sort, page: String(page) });
    if (debouncedSearch) params.set('query', debouncedSearch);
    if (genre) params.set('genre', genre);
    if (year) params.set('year', year);
    if (rating) params.set('rating', rating);
    return `/api/tmdb/catalog?${params}`;
  }, [category, debouncedSearch, genre, mediaType, page, rating, sort, year]);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(false);
    fetch(requestUrl, { signal: controller.signal })
      .then(async (response) => { if (!response.ok) throw new Error('Catalog request failed'); return response.json(); })
      .then((payload: CatalogResult) => setData(payload))
      .catch((requestError) => { if (requestError.name !== 'AbortError') setError(true); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [requestUrl, retry]);

  const changeFilter = <T,>(setter: React.Dispatch<React.SetStateAction<T>>, value: T) => { setter(value); setPage(1); };
  const visibleItems = data.items.filter((item) => !selectedProfile || item.maturityLevel <= selectedProfile.maturityLevel);

  return (
    <div className="mx-auto max-w-screen-2xl px-4 lg:px-8 xl:px-10">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div><h1 className="mb-2 text-3xl font-bold text-white">Films &amp; Séries</h1><p className="text-muted-foreground">Explorez le catalogue TMDB en temps réel.</p></div>
        {selectedProfile?.isKids && <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-xs font-bold text-emerald-300"><ShieldCheck size={15} />Mode enfant · {selectedProfile.maturityLevel}+</span>}
      </div>

      <div className="relative mb-6"><Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Rechercher Interstellar, Dune, Stranger Things..." className="search-input w-full pl-12" /><span className="absolute right-4 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground">{search !== debouncedSearch ? 'Recherche…' : ''}</span></div>

      <div className="mb-5 flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {MEDIA_TABS.map((tab) => <button key={tab.id} onClick={() => changeFilter(setMediaType, tab.id)} className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold ${mediaType === tab.id ? 'bg-primary text-white' : 'border border-border bg-card text-muted-foreground hover:text-white'}`}>{tab.label}</button>)}
        <span className="mx-1 h-9 w-px shrink-0 bg-white/10" />
        {CATEGORY_TABS.map((tab) => <button key={tab.id} onClick={() => changeFilter(setCategory, tab.id)} disabled={Boolean(debouncedSearch)} className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-40 ${category === tab.id && !debouncedSearch ? 'bg-white text-black' : 'border border-border bg-card text-muted-foreground hover:text-white'}`}>{tab.label}</button>)}
      </div>

      <div className="mb-8 flex flex-wrap items-center gap-3">
        <Filter size={16} className="text-muted-foreground" />
        <Select value={genre} onChange={(value) => changeFilter(setGenre, value)}><option value="">Tous les genres</option>{GENRES.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</Select>
        <Select value={year} onChange={(value) => changeFilter(setYear, value)}><option value="">Toutes les années</option>{Array.from({ length: 25 }, (_, index) => 2026 - index).map((value) => <option key={value} value={value}>{value}</option>)}</Select>
        <Select value={rating} onChange={(value) => changeFilter(setRating, value)}><option value="">Toutes les notes</option><option value="9">9+</option><option value="8">8+</option><option value="7">7+</option><option value="6">6+</option></Select>
        <Select value={sort} onChange={(value) => changeFilter(setSort, value as Sort)}><option value="popularity">Popularité</option><option value="rating">Note</option><option value="newest">Année récente</option><option value="oldest">Année ancienne</option><option value="title">Titre A-Z</option></Select>
        <span className="ml-auto text-sm text-muted-foreground">{data.totalResults.toLocaleString('fr-FR')} résultat{data.totalResults !== 1 ? 's' : ''}</span>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8">{Array.from({ length: 16 }, (_, index) => <div key={index} className="aspect-[2/3] animate-pulse rounded-lg bg-white/[0.06]" />)}</div>
      ) : error ? (
        <div className="flex flex-col items-center rounded-2xl border border-red-500/20 bg-red-500/[0.05] py-20 text-center"><RefreshCw size={28} className="text-primary" /><h2 className="mt-4 text-lg font-bold">Impossible de charger TMDB</h2><p className="mt-2 text-sm text-muted-foreground">Vérifiez la connexion puis réessayez.</p><button onClick={() => setRetry((value) => value + 1)} className="mt-5 rounded-lg bg-primary px-4 py-2 text-sm font-bold">Réessayer</button></div>
      ) : visibleItems.length ? (
        <div className="mb-10 grid grid-cols-2 gap-x-3 gap-y-7 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8">{visibleItems.map((item) => <MovieCard key={item.id} id={item.id} title={item.title} posterPath={item.posterPath} year={item.year} rating={item.rating} mediaType={item.mediaType} />)}</div>
      ) : (
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-white/15 bg-white/[0.025] py-24 text-center"><span className="grid size-16 place-items-center rounded-full bg-card"><Search size={28} className="text-muted-foreground" /></span><h2 className="mt-5 text-lg font-bold">Aucun résultat trouvé</h2><p className="mt-2 max-w-sm text-sm text-muted-foreground">Modifiez votre recherche ou vos filtres.</p></div>
      )}

      {!loading && !error && data.totalPages > 1 && <div className="flex items-center justify-center gap-3 py-9"><button disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="grid size-10 place-items-center rounded-lg border border-border bg-card disabled:opacity-30" aria-label="Page précédente"><ChevronLeft size={18} /></button><span className="text-sm text-muted-foreground">Page <strong className="text-white">{page}</strong> sur {data.totalPages}</span><button disabled={page >= data.totalPages} onClick={() => setPage((value) => Math.min(data.totalPages, value + 1))} className="grid size-10 place-items-center rounded-lg border border-border bg-card disabled:opacity-30" aria-label="Page suivante"><ChevronRight size={18} /></button></div>}
    </div>
  );
}

function Select({ value, onChange, children }: { value: string; onChange: (value: string) => void; children: React.ReactNode }) {
  return <div className="relative"><select value={value} onChange={(event) => onChange(event.target.value)} className="filter-select pr-8">{children}</select><ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" /></div>;
}
