'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { Building2, Check, ChevronLeft, Clock, Film, Globe, Info, Play, Plus, Star, UserRound, X } from 'lucide-react';
import AppImage from '@/components/ui/AppImage';
import MovieCard from '@/components/MovieCard';
import { useProfiles } from '@/context/ProfileContext';
import type { MediaDetails, TrailerVideo } from '@/lib/tmdb-types';

const tabs = [
  { id: 'about', label: 'À propos' }, { id: 'cast', label: 'Acteurs' },
  { id: 'similar', label: 'Similaires' }, { id: 'seasons', label: 'Saisons' },
] as const;

export default function DetailContent({ details, error }: { details: MediaDetails | null; error?: string }) {
  const { selectedProfile, toggleWatchlist } = useProfiles();
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]['id']>('about');
  const [trailer, setTrailer] = useState<TrailerVideo | null>(null);
  const [playbackNotice, setPlaybackNotice] = useState(false);
  const availableTabs = useMemo(() => tabs.filter((tab) => tab.id !== 'seasons' || Boolean(details?.seasons.length)), [details?.seasons.length]);

  if (!details) {
    return <div className="mx-auto grid min-h-[70vh] max-w-screen-2xl place-items-center px-5 pt-20 text-center"><div><Info size={34} className="mx-auto text-primary" /><h1 className="mt-5 text-2xl font-extrabold">Titre indisponible</h1><p className="mt-2 text-sm text-muted-foreground">{error || 'Aucune donnée TMDB disponible.'}</p><Link href="/films-series-catalog" className="mt-6 inline-flex rounded-lg bg-primary px-5 py-2.5 text-sm font-bold">Retour au catalogue</Link></div></div>;
  }

  const inList = selectedProfile?.watchlist.includes(details.id) ?? false;
  const preferredTrailer = details.trailers.find((video) => video.official && video.type === 'Trailer') ?? details.trailers.find((video) => video.type === 'Trailer') ?? details.trailers[0];
  const minutes = details.runtimeMinutes;

  return (
    <div className="pb-24 md:pb-4">
      <section className="relative h-[64vh] min-h-[470px] max-h-[760px] w-full overflow-hidden">
        <AppImage src={details.backdropPath} alt={`Scène de ${details.title}`} fill priority sizes="100vw" className="object-cover object-top" />
        <div className="absolute inset-0 backdrop-detail" /><div className="absolute inset-0 bg-gradient-to-t from-background via-background/25 to-black/30" />
        <div className="absolute left-4 top-20 z-10 lg:left-8 xl:left-10"><Link href="/films-series-catalog" className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white/75 hover:text-white"><ChevronLeft size={16} />Retour</Link></div>
        <div className="absolute inset-0 flex items-end">
          <div className="mx-auto w-full max-w-screen-2xl px-4 pb-10 lg:px-8 xl:px-10">
            <div className="flex items-end gap-6">
              <div className="relative hidden h-52 w-36 shrink-0 overflow-hidden rounded-xl border border-white/10 shadow-2xl md:block"><AppImage src={details.posterPath} alt={`Affiche de ${details.title}`} fill sizes="144px" className="object-cover" /></div>
              <div className="min-w-0 flex-1">
                <div className="mb-2 flex items-center gap-2"><span className="rounded border border-primary px-2 py-0.5 text-[10px] font-bold text-primary">TMDB</span><span className="text-xs font-bold uppercase tracking-wider text-white/60">{details.mediaType === 'movie' ? 'Film' : 'Série'}</span></div>
                <h1 className="mb-3 max-w-4xl font-display text-4xl tracking-wide text-white drop-shadow-2xl md:text-5xl lg:text-6xl">{details.title}</h1>
                <div className="mb-4 flex flex-wrap items-center gap-2 text-sm text-white/70"><span>{details.year || 'Date inconnue'}</span>{minutes > 0 && <><span className="text-white/30">•</span><span>{Math.floor(minutes / 60) ? `${Math.floor(minutes / 60)}h ` : ''}{minutes % 60}min</span></>}<span className="text-white/30">•</span>{details.genres.slice(0, 3).map((genre) => <span key={genre}>{genre}</span>)}<span className="rounded border border-white/35 px-1.5 py-0.5 text-xs font-bold">{details.maturityLevel}+</span></div>
                <div className="mb-5 flex items-center gap-2"><Star size={17} fill="#F5B301" className="text-rating" /><span className="text-xl font-bold">{details.rating.toFixed(1)}</span><span className="text-sm text-muted-foreground">/ 10</span></div>
                <div className="flex flex-wrap gap-3"><button type="button" onClick={() => setPlaybackNotice(true)} className="btn-primary"><Play size={18} fill="white" />Regarder</button><button type="button" onClick={() => toggleWatchlist(details.id)} className={`btn-secondary ${inList ? 'border-primary/60 text-primary' : ''}`}>{inList ? <Check size={18} /> : <Plus size={18} />}{inList ? 'Dans ma liste' : 'Ma liste'}</button>{preferredTrailer && <button type="button" onClick={() => setTrailer(preferredTrailer)} className="btn-secondary"><Play size={18} />Bande-annonce</button>}</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="mx-auto mt-6 max-w-screen-2xl px-4 lg:px-8 xl:px-10">
        <p className="mb-8 max-w-3xl text-sm leading-relaxed text-white/75">{details.overview || 'Aucune description française disponible pour ce titre.'}</p>
        <div className="mb-8 flex items-center overflow-x-auto border-b border-border scrollbar-hide">{availableTabs.map((tab) => <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`shrink-0 border-b-2 px-5 py-3 text-sm font-semibold ${activeTab === tab.id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-white'}`}>{tab.label}</button>)}</div>

        {activeTab === 'about' && <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{[
          { icon: Clock, label: 'Durée', value: minutes ? `${minutes} minutes` : 'Non renseignée' },
          { icon: Globe, label: 'Pays', value: details.country || 'Non renseigné' },
          { icon: UserRound, label: details.mediaType === 'movie' ? 'Réalisation' : 'Création', value: details.creators.join(', ') || 'Non renseignée' },
          { icon: Building2, label: 'Production', value: details.productionCompanies.slice(0, 2).join(', ') || 'Non renseignée' },
        ].map((item) => <div key={item.label} className="flex gap-3 rounded-xl border border-white/[0.07] bg-card/60 p-4"><span className="grid size-9 shrink-0 place-items-center rounded-lg bg-white/[0.05]"><item.icon size={17} className="text-muted-foreground" /></span><div><p className="text-xs text-muted-foreground">{item.label}</p><p className="mt-1 text-sm font-semibold">{item.value}</p></div></div>)}</div>}

        {activeTab === 'cast' && (details.cast.length ? <div className="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">{details.cast.map((actor) => <div key={actor.id} className="text-center"><div className="relative mx-auto size-20 overflow-hidden rounded-full border-2 border-border bg-card"><AppImage src={actor.profilePath} alt={actor.name} fill sizes="80px" className="object-cover object-top" /></div><p className="mt-2 text-xs font-bold">{actor.name}</p><p className="mt-1 text-[11px] text-muted-foreground">{actor.character}</p></div>)}</div> : <Empty label="Aucun casting disponible." />)}

        {activeTab === 'similar' && <div>{details.similar.length || details.recommendations.length ? <div className="grid grid-cols-2 gap-x-3 gap-y-7 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">{[...details.recommendations, ...details.similar].filter((item, index, array) => array.findIndex((candidate) => candidate.id === item.id) === index).slice(0, 16).map((item) => <MovieCard key={item.id} id={item.id} title={item.title} posterPath={item.posterPath} year={item.year} rating={item.rating} mediaType={item.mediaType} />)}</div> : <Empty label="Aucun titre similaire disponible." />}</div>}

        {activeTab === 'seasons' && <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">{details.seasons.map((season) => <article key={season.id}><div className="relative aspect-[2/3] overflow-hidden rounded-lg bg-card"><AppImage src={season.posterPath} alt={season.name} fill sizes="180px" className="object-cover" /></div><h3 className="mt-2 text-sm font-bold">{season.name}</h3><p className="text-xs text-muted-foreground">{season.episodeCount} épisode{season.episodeCount !== 1 ? 's' : ''}{season.airDate ? ` · ${season.airDate.slice(0, 4)}` : ''}</p></article>)}</div>}
      </div>

      {trailer && <TrailerModal trailer={trailer} onClose={() => setTrailer(null)} />}
      {playbackNotice && <div className="fixed inset-0 z-[100] grid place-items-center bg-black/80 p-5 backdrop-blur-sm" role="dialog" aria-modal="true"><div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#111418] p-6 text-center shadow-2xl"><Film className="mx-auto text-primary" size={30} /><h2 className="mt-4 text-xl font-extrabold">Lecture complète indisponible</h2><p className="mt-2 text-sm leading-relaxed text-muted-foreground">CINEVERSE ne dispose actuellement d&apos;aucune source de streaming autorisée pour ce titre. Vous pouvez regarder la bande-annonce lorsqu&apos;elle est disponible.</p><div className="mt-6 flex justify-center gap-3">{preferredTrailer && <button onClick={() => { setPlaybackNotice(false); setTrailer(preferredTrailer); }} className="rounded-lg bg-primary px-4 py-2 text-sm font-bold">Voir la bande-annonce</button>}<button onClick={() => setPlaybackNotice(false)} className="rounded-lg border border-white/15 px-4 py-2 text-sm font-bold">Fermer</button></div></div></div>}
    </div>
  );
}

function TrailerModal({ trailer, onClose }: { trailer: TrailerVideo; onClose: () => void }) {
  const url = trailer.site === 'YouTube' ? `https://www.youtube-nocookie.com/embed/${encodeURIComponent(trailer.key)}?autoplay=1&rel=0` : `https://player.vimeo.com/video/${encodeURIComponent(trailer.key)}?autoplay=1`;
  return <div className="fixed inset-0 z-[110] grid place-items-center bg-black/90 p-4 backdrop-blur-md" role="dialog" aria-modal="true" aria-label={trailer.name}><button onClick={onClose} className="absolute right-5 top-5 grid size-10 place-items-center rounded-full bg-white/10 hover:bg-white/20" aria-label="Fermer la bande-annonce"><X /></button><div className="aspect-video w-full max-w-5xl overflow-hidden rounded-xl border border-white/10 bg-black shadow-2xl"><iframe src={url} title={trailer.name} className="size-full" allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen /></div></div>;
}

function Empty({ label }: { label: string }) { return <div className="rounded-xl border border-dashed border-white/10 px-5 py-12 text-center text-sm text-muted-foreground">{label}</div>; }
