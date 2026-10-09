'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Check, ChevronLeft, ChevronRight, Plus, RefreshCw } from 'lucide-react';
import AppImage from '@/components/ui/AppImage';
import { useProfiles } from '@/context/ProfileContext';
import { mediaDetailHref } from '@/lib/media-id';
import type { ContentItem } from '@/lib/profile-types';

export default function HeroCarousel({ items, error = false }: { items: ContentItem[]; error?: boolean }) {
  const { selectedProfile, toggleWatchlist } = useProfiles();
  const visibleItems = useMemo(() => items.filter((item) => !selectedProfile || item.maturityLevel <= selectedProfile.maturityLevel), [items, selectedProfile]);
  const [current, setCurrent] = useState(0);
  const [transitioning, setTransitioning] = useState(false);

  useEffect(() => setCurrent(0), [selectedProfile?.id, visibleItems.length]);
  const goTo = useCallback((index: number) => {
    if (transitioning || !visibleItems.length) return;
    setTransitioning(true);
    window.setTimeout(() => { setCurrent(index); setTransitioning(false); }, 250);
  }, [transitioning, visibleItems.length]);
  const next = useCallback(() => goTo((current + 1) % Math.max(visibleItems.length, 1)), [current, goTo, visibleItems.length]);
  useEffect(() => { if (visibleItems.length < 2) return; const timer = window.setInterval(next, 7000); return () => window.clearInterval(timer); }, [next, visibleItems.length]);

  const item = visibleItems[current];
  if (!item) {
    return (
      <section className="relative grid h-[62vh] min-h-[500px] place-items-center overflow-hidden bg-gradient-to-br from-[#0c0e12] via-[#08090b] to-black px-6 text-center">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_30%,rgba(229,9,20,0.12),transparent_38%)]" />
        <div className="relative max-w-md"><RefreshCw className="mx-auto text-primary" size={30} /><h1 className="mt-5 text-2xl font-extrabold">Catalogue momentanément indisponible</h1><p className="mt-2 text-sm text-muted-foreground">{error ? 'CINEVERSE ne peut pas joindre TMDB pour le moment.' : 'Aucun contenu adapté à ce profil.'}</p><Link href="/films-series-catalog" className="mt-6 inline-flex rounded-lg border border-white/15 px-4 py-2 text-sm font-bold hover:bg-white/10">Ouvrir le catalogue</Link></div>
      </section>
    );
  }

  const inList = selectedProfile?.watchlist.includes(item.id) ?? false;
  // The next slide is kept mounted (hidden, keyed by id) so its backdrop is already loaded when the carousel advances.
  const upcoming = visibleItems.length > 1 ? visibleItems[(current + 1) % visibleItems.length] : undefined;
  const slides = upcoming && upcoming.id !== item.id ? [item, upcoming] : [item];
  return (
    <section className="relative min-h-[max(560px,min(85vh,900px))] w-full overflow-hidden">
      <div className={`absolute inset-0 transition-opacity duration-700 ${transitioning ? 'opacity-0' : 'opacity-100'}`}>{slides.map((slide, index) => <div key={slide.id} className={`absolute inset-0 ${index === 0 ? '' : 'pointer-events-none opacity-0'}`} aria-hidden={index !== 0}><AppImage src={slide.backdropPath} alt={index === 0 ? `Scène de ${slide.title}` : ''} fill priority={index === 0 && current === 0} fetchPriority={index === 0 ? 'high' : 'low'} sizes="100vw" className="object-cover object-center" /></div>)}</div>
      <div className="absolute inset-0 hero-gradient" /><div className="absolute inset-x-0 bottom-0 h-48 hero-gradient-bottom" /><div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-black/30" />
      <div className={`relative flex min-h-[inherit] items-center transition-all duration-500 ${transitioning ? 'translate-y-2 opacity-0' : 'translate-y-0 opacity-100'}`}>
        {/* 152px top and 88px bottom keep the text where it always sat (centred 32px below the middle) while reserving room for the rows that overlap the hero by 64px; the hero grows instead of letting them collide */}
        <div className="mx-auto w-full max-w-screen-2xl px-4 pb-[88px] pt-[152px] lg:px-8 xl:px-10">
          <div className="max-w-xl">
            <div className="mb-3 flex items-center gap-2"><span className="rounded border border-primary px-2 py-0.5 text-xs font-bold text-primary">TMDB</span><span className="text-xs font-semibold uppercase tracking-widest text-white/70">{item.mediaType === 'movie' ? 'Film' : 'Série'}</span></div>
            <h1 className="text-hero-title mb-4 text-white drop-shadow-2xl">{item.title}</h1>
            <div className="mb-4 flex flex-wrap items-center gap-2"><span className="text-sm text-white/70">{item.year || 'Date inconnue'}</span><span className="text-white/30">•</span>{item.genres.slice(0, 3).map((genre) => <span key={genre} className="text-sm text-white/70">{genre}</span>)}<span className="rounded border border-white/40 px-1.5 py-0.5 text-xs font-bold text-white/70">{item.rating.toFixed(1)}</span></div>
            <p className="mb-6 line-clamp-3 max-w-md text-sm leading-relaxed text-white/75">{item.overview || 'Aucune description française disponible.'}</p>
            <div className="flex flex-wrap items-center gap-3"><Link href={mediaDetailHref(item.id)} className="btn-primary text-sm">Plus d&apos;informations</Link><button type="button" onClick={() => toggleWatchlist(item.id)} className="btn-secondary text-sm">{inList ? <Check size={16} /> : <Plus size={16} />}{inList ? 'Dans ma liste' : 'Ma liste'}</button></div>
          </div>
        </div>
      </div>
      {visibleItems.length > 1 && <><button type="button" onClick={() => goTo((current - 1 + visibleItems.length) % visibleItems.length)} className="absolute left-3 top-1/2 z-20 grid size-10 -translate-y-1/2 place-items-center rounded-full border border-white/20 bg-black/40 hover:bg-black/70" aria-label="Précédent"><ChevronLeft size={20} /></button><button type="button" onClick={next} className="absolute right-3 top-1/2 z-20 grid size-10 -translate-y-1/2 place-items-center rounded-full border border-white/20 bg-black/40 hover:bg-black/70" aria-label="Suivant"><ChevronRight size={20} /></button><div className="absolute bottom-20 left-1/2 z-20 flex -translate-x-1/2 gap-2">{visibleItems.map((media, index) => <button key={media.id} onClick={() => goTo(index)} className={`h-2 rounded-full transition-all ${index === current ? 'w-6 bg-primary' : 'w-2 bg-white/30'}`} aria-label={`Afficher ${media.title}`} />)}</div></>}
    </section>
  );
}
