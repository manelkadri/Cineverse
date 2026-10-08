'use client';

import React from 'react';
import Link from 'next/link';
import { Play } from 'lucide-react';
import AppImage from './ui/AppImage';
import type { ContentItem, ViewingProgress } from '@/lib/profile-types';

export default function ContinueWatchingRow({ items }: { items: Array<{ content: ContentItem; progress: ViewingProgress }> }) {
  if (!items.length) return null;
  return (
    <section className="mb-8">
      <div className="mb-3 px-4 lg:px-8 xl:px-10"><h2 className="text-lg font-bold text-white">Continuer à regarder</h2></div>
      <div className="flex gap-3 overflow-x-auto px-4 pb-3 scrollbar-hide lg:px-8 xl:px-10">
        {items.map(({ content, progress }) => {
          const percent = Math.min(100, Math.round((progress.positionSeconds / progress.durationSeconds) * 100));
          const minutes = Math.max(1, Math.ceil((progress.durationSeconds - progress.positionSeconds) / 60));
          return (
            <Link key={content.id} href={`/movie-series-detail?id=${content.id}`} className="group w-[250px] shrink-0 sm:w-[300px] lg:w-[340px]">
              <div className="relative aspect-video overflow-hidden rounded-lg border border-white/10 bg-card shadow-lg">
                <AppImage src={content.backdropPath} alt={content.title} fill sizes="340px" className="object-cover transition-transform duration-500 group-hover:scale-105" />
                <div className="absolute inset-0 bg-black/20 transition-colors group-hover:bg-black/40" />
                <span className="absolute left-1/2 top-1/2 grid size-12 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-white bg-black/45 shadow-xl transition-transform group-hover:scale-110"><Play size={18} fill="white" className="ml-0.5" /></span>
                <div className="absolute inset-x-0 bottom-0 h-1 bg-white/25"><div className="h-full bg-primary" style={{ width: `${percent}%` }} /></div>
              </div>
              <p className="mt-2 truncate text-sm font-bold text-white group-hover:text-primary">{content.title}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{percent}% · {minutes} min restantes</p>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
