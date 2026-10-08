'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import AppImage from '@/components/ui/AppImage';
import { Check, Play, Plus, Star, Clock, Globe, User, Film, ChevronLeft } from 'lucide-react';
import { useProfiles } from '@/context/ProfileContext';
import { CONTENT_CATALOG } from '@/lib/content';

// Backend integration point: replace with TMDB API fetch by ID from searchParams
const MOVIE_DATA = {
  id: 'detail-dune-part-two',
  title: 'Dune: Part Two',
  originalTitle: 'DUNE PART TWO',
  year: 2024,
  duration: '2h 46min',
  genres: ['Science-fiction', 'Aventure'],
  ageRating: '13+',
  rating: 8.5,
  votes: '320K votes',
  synopsis: "Paul Atreides s'unit aux Fremen et entame un voyage spirituel et militaire pour se venger des conspirateurs qui ont détruit sa famille. Alors qu'il affronte un choix entre l'amour de sa vie et le destin de l'univers connu, il s'efforce d'empêcher un terrible avenir que lui seul peut prédire.",
  backdropPath: 'https://image.tmdb.org/t/p/original/xOMo8BRK7PfcJv9JCnx7s5hj0PX.jpg',
  posterPath: 'https://image.tmdb.org/t/p/w500/1pdfLvkbY9ohJlCjQH2CZjjYVvJ.jpg',
  country: 'États-Unis',
  director: 'Denis Villeneuve',
  mediaType: 'film' as const,
  cast: [
    { id: 'cast-timothee', name: 'Timothée Chalamet', character: 'Paul Atreides', photoPath: 'https://image.tmdb.org/t/p/w185/BE2sdjpgsa2rNTFa66f7upkaOP.jpg' },
    { id: 'cast-zendaya', name: 'Zendaya', character: 'Chani', photoPath: 'https://image.tmdb.org/t/p/w185/yk4J7XkEjOleVQmHNQkCtLFuFqw.jpg' },
    { id: 'cast-rebecca', name: 'Rebecca Ferguson', character: 'Lady Jessica', photoPath: 'https://image.tmdb.org/t/p/w185/lJloTOheuQSirSLXNA3JHsrMNfH.jpg' },
    { id: 'cast-javier', name: 'Javier Bardem', character: 'Stilgar', photoPath: 'https://image.tmdb.org/t/p/w185/2cAc9qp8tNAGnONzPBzOXsqMpzY.jpg' },
    { id: 'cast-stellan', name: 'Stellan Skarsgård', character: 'Baron Harkonnen', photoPath: 'https://image.tmdb.org/t/p/w185/xk8bkD6DqJ0GVqfJG8EgFDMp0Q0.jpg' },
    { id: 'cast-austin', name: 'Austin Butler', character: 'Feyd-Rautha', photoPath: 'https://image.tmdb.org/t/p/w185/myNksmxBCyPlb4CV3c5IQAR9KHQ.jpg' },
  ],
  similar: [
    { id: 'sim-interstellar', title: 'Interstellar', posterPath: 'https://image.tmdb.org/t/p/w500/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg', year: 2014, rating: 8.6 },
    { id: 'sim-arrival', title: 'Premier Contact', posterPath: 'https://image.tmdb.org/t/p/w500/x2FJsf1ElAgr63Y3PNPtJrcmpoe.jpg', year: 2016, rating: 8.0 },
    { id: 'sim-blade-runner', title: 'Blade Runner 2049', posterPath: 'https://image.tmdb.org/t/p/w500/gajva2L0rPYkEWjzgFlBXCAVBE5.jpg', year: 2017, rating: 8.0 },
    { id: 'sim-dune1', title: 'Dune: Part One', posterPath: 'https://image.tmdb.org/t/p/w500/d5NXSklpcvkCgnOkdSOnhOCup9y.jpg', year: 2021, rating: 8.0 },
    { id: 'sim-oppenheimer', title: 'Oppenheimer', posterPath: 'https://image.tmdb.org/t/p/w500/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg', year: 2023, rating: 8.5 },
    { id: 'sim-annihilation', title: 'Annihilation', posterPath: 'https://image.tmdb.org/t/p/w500/IlrOWniZBODGBqVnArZAcjAqkh.jpg', year: 2018, rating: 7.5 },
  ],
};

const TABS = [
  { id: 'apropos', label: 'À propos' },
  { id: 'acteurs', label: 'Acteurs' },
  { id: 'similaires', label: 'Similaires' },
];

export default function DetailContent() {
  const [activeTab, setActiveTab] = useState('apropos');
  const searchParams = useSearchParams();
  const { selectedProfile, toggleWatchlist, updateProgress } = useProfiles();
  const requestedId = searchParams.get('id') ?? 'dune-part-two';
  const catalogItem = CONTENT_CATALOG.find((item) => item.id === requestedId);
  const movie = catalogItem ? {
    ...MOVIE_DATA,
    id: catalogItem.id,
    title: catalogItem.title,
    originalTitle: catalogItem.title.toUpperCase(),
    year: catalogItem.year,
    duration: `${Math.floor(catalogItem.durationSeconds / 3600)}h ${Math.floor((catalogItem.durationSeconds % 3600) / 60)}min`,
    genres: catalogItem.genres,
    ageRating: `${catalogItem.maturityLevel}+`,
    rating: catalogItem.rating,
    backdropPath: catalogItem.backdropPath,
    posterPath: catalogItem.posterPath,
    mediaType: catalogItem.mediaType,
  } : MOVIE_DATA;
  const inList = selectedProfile?.watchlist.includes(movie.id) ?? false;
  const progress = selectedProfile?.history.find((item) => item.mediaId === movie.id);

  return (
    <div className="pb-24 md:pb-4">
      {/* Backdrop Hero */}
      <div className="relative w-full h-[60vh] min-h-[420px] max-h-[700px] overflow-hidden">
        <AppImage
          src={movie.backdropPath}
          alt={`Scène du film ${movie.title}`}
          fill
          priority
          sizes="100vw"
          className="object-cover object-top"
          unoptimized
        />
        <div className="absolute inset-0 backdrop-detail" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent" />

        {/* Back button */}
        <div className="absolute top-20 left-4 lg:left-8 xl:left-10 z-10">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm text-white/70 hover:text-white transition-colors bg-black/30 border border-white/10 rounded-lg px-3 py-2"
          >
            <ChevronLeft size={16} />
            Retour
          </Link>
        </div>

        {/* Hero content */}
        <div className="absolute inset-0 flex items-end">
          <div className="max-w-screen-2xl mx-auto px-4 lg:px-8 xl:px-10 w-full pb-10">
            <div className="flex flex-col md:flex-row items-start gap-6">
              {/* Poster */}
              <div className="hidden md:block shrink-0">
                <div className="relative w-36 h-52 rounded-xl overflow-hidden poster-shadow border border-white/10">
                  <AppImage
                    src={movie.posterPath}
                    alt={`Affiche officielle de ${movie.title}`}
                    fill
                    sizes="144px"
                    className="object-cover"
                    unoptimized
                  />
                </div>
              </div>

              {/* Info */}
              <div className="flex-1">
                {/* Title */}
                <h1 className="font-display text-4xl md:text-5xl lg:text-6xl text-white tracking-wider mb-3 drop-shadow-2xl">
                  {movie.originalTitle}
                </h1>

                {/* Metadata row */}
                <div className="flex flex-wrap items-center gap-3 mb-4">
                  <span className="text-white/70 text-sm">{movie.year}</span>
                  <span className="text-white/30">•</span>
                  <span className="text-white/70 text-sm">{movie.duration}</span>
                  <span className="text-white/30">•</span>
                  {movie.genres.map((g) => (
                    <span key={`detail-genre-${g}`} className="text-sm text-white/70">{g}</span>
                  ))}
                  <span className="text-xs font-bold border border-white/40 text-white/70 px-1.5 py-0.5 rounded">
                    {movie.ageRating}
                  </span>
                </div>

                {/* Rating */}
                <div className="flex items-center gap-2 mb-4">
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Star
                        key={`star-${s}`}
                        size={16}
                        fill={s <= Math.round(movie.rating / 2) ? '#F5B301' : 'transparent'}
                        className={s <= Math.round(movie.rating / 2) ? 'text-rating' : 'text-muted-foreground'}
                      />
                    ))}
                  </div>
                  <span className="text-xl font-bold text-white">{movie.rating}</span>
                  <span className="text-sm text-muted-foreground">({movie.votes})</span>
                </div>

                {/* Buttons */}
                <div className="flex flex-wrap items-center gap-3">
                  <button className="btn-primary" onClick={() => updateProgress(movie.id, Math.min((progress?.positionSeconds ?? 0) + 300, catalogItem?.durationSeconds ?? 9960), catalogItem?.durationSeconds ?? 9960)}>
                    <Play size={18} fill="white" />
                    {progress ? 'Reprendre' : 'Regarder'}
                  </button>
                  <button
                    onClick={() => toggleWatchlist(movie.id)}
                    className={`btn-secondary ${inList ? 'border-primary/60 text-primary' : ''}`}
                  >
                    {inList ? <Check size={18} className="text-primary" /> : <Plus size={18} />}
                    {inList ? 'Dans ma liste' : 'Ma liste'}
                  </button>
                </div>
              </div>

              {/* Trailer play overlay button */}
              <div className="hidden lg:flex shrink-0 flex-col items-center gap-2">
                <button className="w-16 h-16 rounded-full bg-white/20 border-2 border-white/60 flex items-center justify-center hover:bg-white/30 hover:scale-110 transition-all duration-200">
                  <Play size={24} fill="white" className="text-white ml-1" />
                </button>
                <span className="text-xs text-white/60 font-medium">Bande-annonce</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Synopsis (mobile visible) */}
      <div className="max-w-screen-2xl mx-auto px-4 lg:px-8 xl:px-10 mt-6 md:mt-0">
        <p className="text-sm text-white/75 leading-relaxed mb-8 max-w-2xl">
          {movie.synopsis}
        </p>

        {/* Tabs */}
        <div className="flex items-center gap-0 border-b border-border mb-8">
          {TABS.map((tab) => (
            <button
              key={`detail-tab-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              className={`px-6 py-3 text-sm font-semibold transition-all duration-200 border-b-2 -mb-px ${
                activeTab === tab.id
                  ? 'text-primary border-primary' :'text-muted-foreground border-transparent hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab: À propos */}
        {activeTab === 'apropos' && (
          <div className="animate-fade-in">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-10">
              {[
                { icon: Clock, label: 'Durée', value: movie.duration },
                { icon: Globe, label: 'Pays', value: movie.country },
                { icon: User, label: 'Réalisateur', value: movie.director },
                { icon: Film, label: 'Genre', value: movie.genres[0] },
              ].map((info) => (
                <div key={`info-${info.label}`} className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-card border border-border flex items-center justify-center shrink-0 mt-0.5">
                    <info.icon size={16} className="text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground font-medium mb-0.5">{info.label}</p>
                    <p className="text-sm font-semibold text-white">{info.value}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab: Acteurs */}
        {activeTab === 'acteurs' && (
          <div className="animate-fade-in">
            <h3 className="text-base font-bold text-white mb-5">Casting principal</h3>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-6 xl:grid-cols-8 gap-4">
              {movie.cast.map((actor) => (
                <div key={actor.id} className="flex flex-col items-center text-center group">
                  <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-full overflow-hidden bg-card border-2 border-border group-hover:border-primary/50 transition-colors mb-2 poster-shadow">
                    <AppImage
                      src={actor.photoPath}
                      alt={`Photo de ${actor.name}, acteur dans ${movie.title}`}
                      fill
                      sizes="80px"
                      className="object-cover object-top"
                      unoptimized
                    />
                  </div>
                  <p className="text-xs font-semibold text-white leading-tight">{actor.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-tight">{actor.character}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab: Similaires */}
        {activeTab === 'similaires' && (
          <div className="animate-fade-in">
            <h3 className="text-base font-bold text-white mb-5">Titres similaires</h3>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8 gap-3">
              {movie.similar.map((sim) => (
                <Link key={sim.id} href={`/movie-series-detail?id=${sim.id}`} className="block group">
                  <div className="relative aspect-[2/3] rounded-lg overflow-hidden bg-card poster-shadow transition-transform duration-300 group-hover:scale-105">
                    <AppImage
                      src={sim.posterPath}
                      alt={`Affiche du film similaire ${sim.title}`}
                      fill
                      sizes="(max-width: 640px) 33vw, 15vw"
                      className="object-cover"
                      unoptimized
                    />
                  </div>
                  <div className="mt-2 px-0.5">
                    <p className="text-xs font-semibold text-white/80 truncate">{sim.title}</p>
                    <div className="flex items-center gap-1 mt-0.5">
                      <Star size={9} fill="#F5B301" className="text-rating" />
                      <span className="text-xs text-rating font-semibold">{sim.rating.toFixed(1)}</span>
                      <span className="text-xs text-muted-foreground">{sim.year}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
