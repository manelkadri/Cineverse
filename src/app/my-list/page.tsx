'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { BookmarkPlus, Heart, RefreshCw, Sparkles } from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import ProfileGate from '@/components/ProfileGate';
import MovieCard from '@/components/MovieCard';
import MovieRow from '@/components/MovieRow';
import ContinueWatchingRow from '@/components/ContinueWatchingRow';
import ProfileAvatar from '@/components/ProfileAvatar';
import { useProfiles } from '@/context/ProfileContext';
import type { ContentItem } from '@/lib/profile-types';

const toMovies = (items: ContentItem[]) => items.map((item) => ({ id: item.id, title: item.title, posterPath: item.posterPath, year: item.year, rating: item.rating, mediaType: item.mediaType }));

export default function MyListPage() { return <ProfileGate><MyListContent /></ProfileGate>; }

function MyListContent() {
  const { selectedProfile } = useProfiles();
  const [items, setItems] = useState<ContentItem[]>([]);
  const [recommendations, setRecommendations] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const ids = useMemo(() => selectedProfile ? Array.from(new Set([...selectedProfile.watchlist, ...selectedProfile.favorites, ...selectedProfile.history.map((entry) => entry.mediaId)])) : [], [selectedProfile]);

  useEffect(() => {
    if (!selectedProfile) return;
    const controller = new AbortController();
    setLoading(true); setError(false);
    Promise.all([
      ids.length ? fetch('/api/tmdb/media', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids }), signal: controller.signal }).then((response) => { if (!response.ok) throw new Error(); return response.json(); }) : Promise.resolve({ items: [] }),
      fetch('/api/recommendations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(selectedProfile), signal: controller.signal }).then((response) => response.ok ? response.json() : { recommendations: [] }),
    ]).then(([media, recs]) => { setItems(media.items ?? []); setRecommendations(recs.recommendations ?? []); }).catch((requestError) => { if (requestError.name !== 'AbortError') setError(true); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [ids, retry, selectedProfile]);

  if (!selectedProfile) return null;
  const byId = new Map(items.map((item) => [item.id, item]));
  const watchlist = selectedProfile.watchlist.map((id) => byId.get(id)).filter(Boolean) as ContentItem[];
  const favorites = selectedProfile.favorites.map((id) => byId.get(id)).filter(Boolean) as ContentItem[];
  const continueItems = selectedProfile.history.map((progress) => ({ content: byId.get(progress.mediaId), progress })).filter((item): item is { content: ContentItem; progress: (typeof selectedProfile.history)[number] } => Boolean(item.content) && item.progress.durationSeconds > 0 && item.progress.positionSeconds / item.progress.durationSeconds < 0.95);

  return (
    <main className="min-h-screen bg-background">
      <Navbar />
      <div className="mx-auto max-w-screen-2xl px-4 pb-16 pt-24 lg:px-8 xl:px-10">
        <header className="mb-8 flex items-center gap-4 border-b border-white/[0.08] pb-7"><ProfileAvatar avatar={selectedProfile.avatar} name={selectedProfile.name} className="size-14 rounded-xl" /><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">{selectedProfile.name}</p><h1 className="mt-1 text-3xl font-extrabold tracking-tight">Ma liste</h1></div></header>

        {loading ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">{Array.from({ length: 7 }, (_, index) => <div key={index} className="aspect-[2/3] animate-pulse rounded-lg bg-white/[0.06]" />)}</div> : error ? <div className="rounded-2xl border border-red-500/20 bg-red-500/[0.05] px-6 py-16 text-center"><RefreshCw className="mx-auto text-primary" /><h2 className="mt-4 text-xl font-bold">Impossible de charger votre liste</h2><button onClick={() => setRetry((value) => value + 1)} className="mt-5 rounded-lg bg-primary px-4 py-2 text-sm font-bold">Réessayer</button></div> : <>
          {watchlist.length ? <section><div className="mb-5 flex items-center gap-2"><BookmarkPlus size={18} className="text-primary" /><h2 className="text-lg font-bold">Titres enregistrés</h2><span className="text-sm text-muted-foreground">{watchlist.length}</span></div><div className="grid grid-cols-2 gap-x-3 gap-y-7 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8">{watchlist.map((item) => <MovieCard key={item.id} id={item.id} title={item.title} posterPath={item.posterPath} year={item.year} rating={item.rating} mediaType={item.mediaType} />)}</div></section> : <section className="rounded-2xl border border-dashed border-white/15 bg-gradient-to-br from-white/[0.045] to-transparent px-6 py-16 text-center"><span className="mx-auto grid size-16 place-items-center rounded-full border border-white/10 bg-white/[0.05] text-muted-foreground"><BookmarkPlus size={28} /></span><h2 className="mt-5 text-xl font-extrabold">Votre liste est vide</h2><p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">Ajoutez des films et séries depuis le catalogue. Ils seront enregistrés uniquement pour {selectedProfile.name}.</p><Link href="/films-series-catalog" className="mt-6 inline-flex rounded-lg bg-primary px-5 py-2.5 text-sm font-bold">Explorer le catalogue</Link></section>}
          {continueItems.length > 0 && <div className="-mx-4 mt-11 lg:-mx-8 xl:-mx-10"><ContinueWatchingRow items={continueItems} /></div>}
          {favorites.length > 0 && <section className="mt-9"><div className="mb-5 flex items-center gap-2"><Heart size={18} fill="currentColor" className="text-primary" /><h2 className="text-lg font-bold">Favoris</h2></div><div className="grid grid-cols-2 gap-x-3 gap-y-7 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8">{favorites.map((item) => <MovieCard key={item.id} id={item.id} title={item.title} posterPath={item.posterPath} year={item.year} rating={item.rating} mediaType={item.mediaType} />)}</div></section>}
          <section className="mt-12 border-t border-white/[0.08] pt-9"><div className="mb-1 flex items-center gap-2"><Sparkles size={18} className="text-primary" /><h2 className="text-lg font-bold">Sélection pour {selectedProfile.name}</h2></div>{recommendations.length ? <div className="-mx-4 lg:-mx-8 xl:-mx-10"><MovieRow title="Inspiré de vos préférences" movies={toMovies(recommendations)} /></div> : <p className="mt-4 text-sm text-muted-foreground">Ajoutez des préférences à ce profil pour recevoir des recommandations.</p>}</section>
        </>}
      </div>
      <Footer />
    </main>
  );
}
