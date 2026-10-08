'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import AppImage from '@/components/ui/AppImage';
import { Check, Heart, Play, Plus, Star } from 'lucide-react';
import { useProfiles } from '@/context/ProfileContext';
import { mediaDetailHref } from '@/lib/media-id';
import type { MediaType } from '@/lib/profile-types';

interface MovieCardProps {
  id: string;
  title: string;
  posterPath: string;
  year: number;
  rating: number;
  mediaType?: MediaType;
  href?: string;
}

export default function MovieCard({ id, title, posterPath, year, rating, mediaType, href }: MovieCardProps) {
  const [hovered, setHovered] = useState(false);
  const { selectedProfile, toggleWatchlist, toggleFavorite } = useProfiles();
  const detailHref = href || mediaDetailHref(id);
  const inList = selectedProfile?.watchlist.includes(id) ?? false;
  const favorite = selectedProfile?.favorites.includes(id) ?? false;

  return (
    <Link href={detailHref} className="block">
      <div
        className="movie-card card-hover-scale group"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {/* Poster */}
        <div className="relative aspect-[2/3] overflow-hidden rounded-lg bg-card">
          <AppImage
            src={posterPath}
            alt={`Affiche du film ${title}`}
            fill
            sizes="(max-width: 640px) 40vw, (max-width: 1024px) 20vw, 15vw"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />

          {/* Serie badge */}
          {mediaType === 'tv' && (
            <span className="badge-serie">Série</span>
          )}

          {/* Hover overlay */}
          <div
            className={`absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent transition-opacity duration-300 ${
              hovered ? 'opacity-100' : 'opacity-0'
            }`}
          />

          {/* Quick actions */}
          <div
            className={`absolute bottom-0 left-0 right-0 p-3 transition-all duration-300 ${
              hovered ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              <button
                className="w-8 h-8 rounded-full bg-primary flex items-center justify-center hover:bg-primary-hover transition-colors"
                aria-label={`Regarder ${title}`}
                onClick={(e) => e.preventDefault()}
              >
                <Play size={14} fill="white" className="text-white ml-0.5" />
              </button>
              <button
                className="w-8 h-8 rounded-full bg-white/20 border border-white/40 flex items-center justify-center hover:bg-white/30 transition-colors"
                aria-label={inList ? `Retirer ${title} de ma liste` : `Ajouter ${title} à ma liste`}
                onClick={(e) => { e.preventDefault(); toggleWatchlist(id); }}
              >
                {inList ? <Check size={14} className="text-white" /> : <Plus size={14} className="text-white" />}
              </button>
              <button
                className="w-8 h-8 rounded-full bg-white/20 border border-white/40 flex items-center justify-center hover:bg-white/30 transition-colors ml-auto"
                aria-label={favorite ? `Retirer ${title} des favoris` : `Ajouter ${title} aux favoris`}
                onClick={(e) => { e.preventDefault(); toggleFavorite(id); }}
              >
                <Heart size={14} fill={favorite ? 'white' : 'none'} className="text-white" />
              </button>
            </div>
            <div className="flex items-center gap-1">
              <Star size={11} fill="#F5B301" className="text-rating shrink-0" />
              <span className="text-xs font-semibold text-white">{rating.toFixed(1)}</span>
            </div>
          </div>
        </div>

        {/* Card info */}
        <div className="mt-2 px-0.5">
          <p className="text-sm font-semibold text-white truncate leading-tight">{title}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-muted-foreground">{year}</span>
            <div className="flex items-center gap-0.5">
              <Star size={10} fill="#F5B301" className="text-rating" />
              <span className="text-xs font-semibold text-rating">{rating.toFixed(1)}</span>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
