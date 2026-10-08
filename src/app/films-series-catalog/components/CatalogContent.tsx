'use client';

import React, { useMemo, useState } from 'react';
import { ChevronDown, Filter, Search, ShieldCheck } from 'lucide-react';
import MovieCard from '@/components/MovieCard';
import { useProfiles } from '@/context/ProfileContext';
import { CONTENT_CATALOG } from '@/lib/content';

export default function CatalogContent() {
  const { selectedProfile } = useProfiles();
  const [search, setSearch] = useState('');
  const [type, setType] = useState<'all' | 'film' | 'serie'>('all');
  const [genre, setGenre] = useState('Tous les genres');
  const [sort, setSort] = useState('Popularité');
  const genres = useMemo(() => ['Tous les genres', ...Array.from(new Set(CONTENT_CATALOG.flatMap((item) => item.genres))).sort()], []);

  const filtered = useMemo(() => {
    const maturity = selectedProfile?.maturityLevel ?? 18;
    let items = CONTENT_CATALOG.filter((item) => item.maturityLevel <= maturity);
    if (search.trim()) items = items.filter((item) => item.title.toLowerCase().includes(search.trim().toLowerCase()));
    if (type !== 'all') items = items.filter((item) => item.mediaType === type);
    if (genre !== 'Tous les genres') items = items.filter((item) => item.genres.includes(genre));
    if (sort === 'Note') items = [...items].sort((a, b) => b.rating - a.rating);
    if (sort === 'Année') items = [...items].sort((a, b) => b.year - a.year);
    if (sort === 'Titre A-Z') items = [...items].sort((a, b) => a.title.localeCompare(b.title));
    return items;
  }, [genre, search, selectedProfile?.maturityLevel, sort, type]);

  return (
    <div className="mx-auto max-w-screen-2xl px-4 lg:px-8 xl:px-10">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div><h1 className="mb-2 text-3xl font-bold text-white">Films &amp; Séries</h1><p className="text-muted-foreground">Découvrez le catalogue CINEVERSE personnalisé pour {selectedProfile?.name}.</p></div>
        {selectedProfile?.isKids && <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5 text-xs font-bold text-emerald-300"><ShieldCheck size={15} />Mode enfant · {selectedProfile.maturityLevel}+</span>}
      </div>

      <div className="relative mb-6"><Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Rechercher un film ou une série..." className="search-input w-full pl-12" /></div>

      <div className="mb-8 flex flex-wrap items-center gap-3">
        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
          {[{ id: 'all', label: 'Tous' }, { id: 'film', label: 'Films' }, { id: 'serie', label: 'Séries' }].map((tab) => <button key={tab.id} onClick={() => setType(tab.id as typeof type)} className={`rounded-full px-4 py-2 text-sm font-semibold ${type === tab.id ? 'bg-primary text-white' : 'border border-border bg-card text-muted-foreground hover:text-white'}`}>{tab.label}</button>)}
        </div>
        <Filter size={16} className="ml-1 text-muted-foreground" />
        <div className="relative"><select value={genre} onChange={(event) => setGenre(event.target.value)} className="filter-select pr-8">{genres.map((item) => <option key={item} value={item}>{item}</option>)}</select><ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" /></div>
        <div className="relative"><select value={sort} onChange={(event) => setSort(event.target.value)} className="filter-select pr-8"><option>Popularité</option><option>Note</option><option>Année</option><option>Titre A-Z</option></select><ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" /></div>
        <span className="ml-auto text-sm text-muted-foreground">{filtered.length} résultat{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {filtered.length ? (
        <div className="mb-10 grid grid-cols-2 gap-x-3 gap-y-7 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8">
          {filtered.map((item) => <MovieCard key={item.id} id={item.id} title={item.title} posterPath={item.posterPath} year={item.year} rating={item.rating} mediaType={item.mediaType} />)}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/15 bg-white/[0.025] py-24 text-center"><span className="grid size-16 place-items-center rounded-full bg-card"><Search size={28} className="text-muted-foreground" /></span><h2 className="mt-5 text-lg font-bold">Aucun titre trouvé</h2><p className="mt-2 max-w-sm text-sm text-muted-foreground">Essayez une autre recherche ou modifiez vos filtres.</p></div>
      )}
    </div>
  );
}
