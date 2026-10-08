'use client';
import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import AppImage from '@/components/ui/AppImage';
import { Play, Plus, ChevronLeft, ChevronRight } from 'lucide-react';

const HERO_ITEMS = [
{
  id: 'hero-the-last-of-us',
  title: 'THE LAST OF US',
  type: 'SÉRIE',
  network: 'HBO',
  year: '2023',
  seasons: '2 saisons',
  genres: ['Drame', 'Science-fiction'],
  rating: '16+',
  synopsis: "Dans un monde post-apocalyptique, un survivant endurci est chargé d'escorter une adolescente qui pourrait sauver l'humanité.",
  backdropPath: '/assets/images/heroes/the-last-of-us-v2.png',
  posterPath: '/assets/images/heroes/the-last-of-us-v2.png',
  href: '/movie-series-detail?id=the-last-of-us'
},
{
  id: 'hero-dune-part-two',
  title: 'DUNE: PART TWO',
  type: 'FILM',
  network: null,
  year: '2024',
  seasons: '2h 46min',
  genres: ['Science-fiction', 'Aventure'],
  rating: '13+',
  synopsis: "Paul Atreides s\'unit aux Fremen et entame un voyage spirituel et militaire pour se venger des conspirateurs qui ont détruit sa famille.",
  backdropPath: '/assets/images/heroes/dune-part-two-v2.png',
  posterPath: '/assets/images/heroes/dune-part-two-v2.png',
  href: '/movie-series-detail?id=dune-part-two'
},
{
  id: 'hero-oppenheimer',
  title: 'OPPENHEIMER',
  type: 'FILM',
  network: null,
  year: '2023',
  seasons: '3h 00min',
  genres: ['Biographie', 'Drame', 'Histoire'],
  rating: '13+',
  synopsis: "L\'histoire du physicien J. Robert Oppenheimer et de son rôle dans le développement de la bombe atomique pendant la Seconde Guerre mondiale.",
  backdropPath: '/assets/images/heroes/oppenheimer-v2.png',
  posterPath: '/assets/images/heroes/oppenheimer-v2.png',
  href: '/movie-series-detail?id=oppenheimer'
},
{
  id: 'hero-breaking-bad',
  title: 'BREAKING BAD',
  type: 'SÉRIE',
  network: 'AMC',
  year: '2008',
  seasons: '5 saisons',
  genres: ['Crime', 'Thriller', 'Drame'],
  rating: '18+',
  synopsis: "Un professeur de chimie atteint d\'un cancer terminal se tourne vers la fabrication de méthamphétamine pour assurer l\'avenir de sa famille.",
  backdropPath: '/assets/images/heroes/breaking-bad-v2.png',
  posterPath: '/assets/images/heroes/breaking-bad-v2.png',
  href: '/movie-series-detail?id=breaking-bad'
}];


export default function HeroCarousel() {
  const [current, setCurrent] = useState(0);
  const [transitioning, setTransitioning] = useState(false);

  const goTo = useCallback((index: number) => {
    if (transitioning) return;
    setTransitioning(true);
    setTimeout(() => {
      setCurrent(index);
      setTransitioning(false);
    }, 300);
  }, [transitioning]);

  const prev = () => goTo((current - 1 + HERO_ITEMS.length) % HERO_ITEMS.length);
  const next = useCallback(() => goTo((current + 1) % HERO_ITEMS.length), [current, goTo]);

  useEffect(() => {
    const timer = setInterval(next, 7000);
    return () => clearInterval(timer);
  }, [next]);

  const item = HERO_ITEMS[current];

  return (
    <div className="relative w-full h-[85vh] min-h-[560px] max-h-[900px] overflow-hidden">
      {/* Backdrop */}
      <div
        className={`absolute inset-0 transition-opacity duration-700 ${transitioning ? 'opacity-0' : 'opacity-100'}`}>
        
        <AppImage
          src={item.backdropPath}
          alt={`Scène du film ${item.title}`}
          fill
          priority
          sizes="100vw"
          className="object-cover object-center" />
        
      </div>

      {/* Gradients */}
      <div className="absolute inset-0 hero-gradient" />
      <div className="absolute bottom-0 left-0 right-0 h-48 hero-gradient-bottom" />
      <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-black/30" />

      {/* Content */}
      <div
        className={`absolute inset-0 flex items-center transition-all duration-500 ${
        transitioning ? 'opacity-0 translate-y-2' : 'opacity-100 translate-y-0'}`
        }>
        
        <div className="max-w-screen-2xl mx-auto px-4 lg:px-8 xl:px-10 w-full pt-16">
          <div className="max-w-xl">
            {/* Badge */}
            <div className="flex items-center gap-2 mb-3">
              {item.network &&
              <span className="text-xs font-bold text-primary border border-primary px-2 py-0.5 rounded">
                  {item.network}
                </span>
              }
              <span className="text-xs font-semibold text-white/70 uppercase tracking-widest">
                {item.type}
              </span>
            </div>

            {/* Title */}
            <h1 className="text-hero-title text-white mb-4 drop-shadow-2xl">
              {item.title}
            </h1>

            {/* Metadata */}
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <span className="text-sm text-white/70">{item.year}</span>
              <span className="text-white/30">•</span>
              <span className="text-sm text-white/70">{item.seasons}</span>
              {item.genres.map((g) =>
              <span key={`hero-genre-${g}`} className="text-sm text-white/70">{g}</span>
              )}
              <span className="text-xs font-bold border border-white/40 text-white/70 px-1.5 py-0.5 rounded">
                {item.rating}
              </span>
            </div>

            {/* Synopsis */}
            <p className="text-sm text-white/75 leading-relaxed mb-6 line-clamp-3 max-w-md">
              {item.synopsis}
            </p>

            {/* Buttons */}
            <div className="flex flex-wrap items-center gap-3">
              <Link href={item.href} className="btn-primary text-sm">
                <Play size={16} fill="white" />
                Regarder
              </Link>
              <button className="btn-secondary text-sm">
                <Plus size={16} />
                Ma liste
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Nav arrows */}
      <button
        onClick={prev}
        className="absolute left-3 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-black/40 border border-white/20 flex items-center justify-center hover:bg-black/70 hover:border-white/40 transition-all duration-200"
        aria-label="Précédent">
        
        <ChevronLeft size={20} className="text-white" />
      </button>
      <button
        onClick={next}
        className="absolute right-3 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-black/40 border border-white/20 flex items-center justify-center hover:bg-black/70 hover:border-white/40 transition-all duration-200"
        aria-label="Suivant">
        
        <ChevronRight size={20} className="text-white" />
      </button>

      {/* Dots */}
      <div className="absolute bottom-20 left-1/2 -translate-x-1/2 flex items-center gap-2 z-20">
        {HERO_ITEMS.map((_, i) =>
        <button
          key={`hero-dot-${i}`}
          onClick={() => goTo(i)}
          className={`rounded-full transition-all duration-300 ${
          i === current ?
          'w-6 h-2 bg-primary' : 'w-2 h-2 bg-white/30 hover:bg-white/60'}`
          }
          aria-label={`Aller au slide ${i + 1}`} />

        )}
      </div>
    </div>);

}
