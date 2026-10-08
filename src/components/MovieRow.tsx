'use client';
import React, { useRef, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import MovieCard from './MovieCard';

interface Movie {
  id: string;
  title: string;
  posterPath: string;
  year: number;
  rating: number;
  mediaType?: 'film' | 'serie';
}

interface MovieRowProps {
  title: string;
  movies: Movie[];
  seeAllHref?: string;
}

export default function MovieRow({ title, movies, seeAllHref = '/films-series-catalog' }: MovieRowProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const scroll = (direction: 'left' | 'right') => {
    const el = scrollRef.current;
    if (!el) return;
    const amount = el.clientWidth * 0.75;
    el.scrollBy({ left: direction === 'right' ? amount : -amount, behavior: 'smooth' });
  };

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
  };

  return (
    <section className="mb-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 px-4 lg:px-8 xl:px-10">
        <h2 className="text-lg font-bold text-white">{title}</h2>
        <Link
          href={seeAllHref}
          className="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-primary transition-colors group"
        >
          Voir tout
          <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
        </Link>
      </div>

      {/* Carousel */}
      <div className="relative group/row">
        {/* Left arrow */}
        {canScrollLeft && (
          <button
            onClick={() => scroll('left')}
            className="absolute left-1 top-1/3 -translate-y-1/2 z-20 w-10 h-16 bg-background/80 border border-border rounded-md flex items-center justify-center opacity-0 group-hover/row:opacity-100 transition-all duration-200 hover:bg-card hover:border-primary/50"
            aria-label="Défiler à gauche"
          >
            <ChevronLeft size={20} className="text-white" />
          </button>
        )}

        {/* Right arrow */}
        {canScrollRight && (
          <button
            onClick={() => scroll('right')}
            className="absolute right-1 top-1/3 -translate-y-1/2 z-20 w-10 h-16 bg-background/80 border border-border rounded-md flex items-center justify-center opacity-0 group-hover/row:opacity-100 transition-all duration-200 hover:bg-card hover:border-primary/50"
            aria-label="Défiler à droite"
          >
            <ChevronRight size={20} className="text-white" />
          </button>
        )}

        {/* Scroll container */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex gap-3 overflow-x-auto scrollbar-hide px-4 lg:px-8 xl:px-10 pb-2"
        >
          {movies.map((movie) => (
            <div key={movie.id} className="shrink-0 w-[140px] sm:w-[160px] lg:w-[180px]">
              <MovieCard
                id={movie.id}
                title={movie.title}
                posterPath={movie.posterPath}
                year={movie.year}
                rating={movie.rating}
                mediaType={movie.mediaType}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
