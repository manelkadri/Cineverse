'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import { BookmarkPlus, Heart, Sparkles } from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import ProfileGate from '@/components/ProfileGate';
import MovieCard from '@/components/MovieCard';
import MovieRow from '@/components/MovieRow';
import ContinueWatchingRow from '@/components/ContinueWatchingRow';
import ProfileAvatar from '@/components/ProfileAvatar';
import { useProfiles } from '@/context/ProfileContext';
import { CONTENT_CATALOG, getContent, getRecommendations } from '@/lib/content';

export default function MyListPage() {
  return <ProfileGate><MyListContent /></ProfileGate>;
}

function MyListContent() {
  const { selectedProfile } = useProfiles();
  const recommendations = useMemo(() => getRecommendations(selectedProfile, 8), [selectedProfile]);
  if (!selectedProfile) return null;

  const watchlist = getContent(selectedProfile.watchlist, selectedProfile);
  const favorites = getContent(selectedProfile.favorites, selectedProfile);
  const continueItems = selectedProfile.history
    .filter((progress) => progress.durationSeconds > 0 && progress.positionSeconds / progress.durationSeconds < 0.95)
    .map((progress) => ({ content: CONTENT_CATALOG.find((item) => item.id === progress.mediaId && item.maturityLevel <= selectedProfile.maturityLevel), progress }))
    .filter((item): item is { content: (typeof CONTENT_CATALOG)[number]; progress: (typeof selectedProfile.history)[number] } => Boolean(item.content));
  const toMovies = (items: typeof watchlist) => items.map((item) => ({ id: item.id, title: item.title, posterPath: item.posterPath, year: item.year, rating: item.rating, mediaType: item.mediaType }));

  return (
    <main className="min-h-screen bg-background">
      <Navbar />
      <div className="mx-auto max-w-screen-2xl px-4 pb-16 pt-24 lg:px-8 xl:px-10">
        <header className="mb-8 flex items-center gap-4 border-b border-white/[0.08] pb-7">
          <ProfileAvatar avatar={selectedProfile.avatar} name={selectedProfile.name} className="size-14 rounded-xl" />
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">{selectedProfile.name}</p>
            <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-white">Ma liste</h1>
          </div>
        </header>

        {watchlist.length ? (
          <section aria-labelledby="saved-heading">
            <div className="mb-5 flex items-center gap-2"><BookmarkPlus size={18} className="text-primary" /><h2 id="saved-heading" className="text-lg font-bold">Titres enregistrés</h2><span className="text-sm text-muted-foreground">{watchlist.length}</span></div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-7 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8">
              {watchlist.map((item) => <MovieCard key={item.id} id={item.id} title={item.title} posterPath={item.posterPath} year={item.year} rating={item.rating} mediaType={item.mediaType} />)}
            </div>
          </section>
        ) : (
          <section className="rounded-2xl border border-dashed border-white/15 bg-gradient-to-br from-white/[0.045] to-transparent px-6 py-16 text-center">
            <span className="mx-auto grid size-16 place-items-center rounded-full border border-white/10 bg-white/[0.05] text-muted-foreground"><BookmarkPlus size={28} /></span>
            <h2 className="mt-5 text-xl font-extrabold">Votre liste est vide</h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">Ajoutez des films et séries depuis le catalogue. Ils seront enregistrés uniquement pour le profil {selectedProfile.name}.</p>
            <Link href="/films-series-catalog" className="mt-6 inline-flex rounded-lg bg-primary px-5 py-2.5 text-sm font-bold text-white hover:bg-primary-hover">Explorer le catalogue</Link>
          </section>
        )}

        {continueItems.length > 0 && <div className="-mx-4 mt-11 lg:-mx-8 xl:-mx-10"><ContinueWatchingRow items={continueItems} /></div>}

        {favorites.length > 0 && (
          <section className="mt-9">
            <div className="mb-5 flex items-center gap-2"><Heart size={18} fill="currentColor" className="text-primary" /><h2 className="text-lg font-bold">Favoris</h2></div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-7 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8">
              {favorites.map((item) => <MovieCard key={item.id} id={item.id} title={item.title} posterPath={item.posterPath} year={item.year} rating={item.rating} mediaType={item.mediaType} />)}
            </div>
          </section>
        )}

        <section className="mt-12 border-t border-white/[0.08] pt-9">
          <div className="mb-1 flex items-center gap-2 px-0"><Sparkles size={18} className="text-primary" /><h2 className="text-lg font-bold">Sélection pour {selectedProfile.name}</h2></div>
          <div className="-mx-4 lg:-mx-8 xl:-mx-10"><MovieRow title="Inspiré de vos préférences" movies={toMovies(recommendations)} /></div>
        </section>
      </div>
      <Footer />
    </main>
  );
}
