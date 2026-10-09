'use client';

import React, { useEffect, useMemo, useState } from 'react';
import MovieRow from '@/components/MovieRow';
import ContinueWatchingRow from '@/components/ContinueWatchingRow';
import { useProfiles } from '@/context/ProfileContext';
import { useTransitionReady } from '@/components/CinematicTransitionProvider';
import type { ContentItem } from '@/lib/profile-types';
import type { HomeSections } from '@/lib/tmdb-types';

function RowSkeleton({ title }: { title: string }) {
  return <section className="mb-8 px-4 lg:px-8 xl:px-10"><h2 className="mb-3 text-lg font-bold">{title}</h2><div className="flex gap-3 overflow-hidden">{[1, 2, 3, 4, 5, 6].map((item) => <div key={item} className="aspect-[2/3] w-[140px] shrink-0 animate-pulse rounded-lg bg-white/[0.06] sm:w-[160px] lg:w-[180px]" />)}</div></section>;
}

const toMovies = (items: ContentItem[]) => items.map((item) => ({ id: item.id, title: item.title, posterPath: item.posterPath, year: item.year, rating: item.rating, mediaType: item.mediaType }));

export default function HomeRows({ sections, error = false }: { sections: HomeSections; error?: boolean }) {
  const { selectedProfile } = useProfiles();
  const [profileMedia, setProfileMedia] = useState<ContentItem[]>([]);
  const [recommendations, setRecommendations] = useState<ContentItem[]>([]);
  const [loadingPersonal, setLoadingPersonal] = useState(false);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const activityIds = useMemo(() => selectedProfile ? Array.from(new Set([...selectedProfile.watchlist, ...selectedProfile.history.map((item) => item.mediaId)])) : [], [selectedProfile]);

  useEffect(() => {
    if (!selectedProfile) return;
    const controller = new AbortController();
    setLoadingPersonal(true);
    Promise.all([
      activityIds.length ? fetch('/api/tmdb/media', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: activityIds }), signal: controller.signal }).then((response) => response.ok ? response.json() : { items: [] }) : Promise.resolve({ items: [] }),
      fetch('/api/recommendations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ profileId: selectedProfile.id }), signal: controller.signal }).then((response) => response.ok ? response.json() : { recommendations: [] }),
    ]).then(([media, recs]) => { setProfileMedia(media.items ?? []); setRecommendations(recs.recommendations ?? []); }).catch(() => undefined).finally(() => { setLoadingPersonal(false); if (!controller.signal.aborted) setLoadedFor(selectedProfile.id); });
    return () => controller.abort();
  }, [activityIds, selectedProfile]);

  // The cinematic profile intro waits for this: the selected profile's personal data finished loading (even if it failed).
  useTransitionReady(selectedProfile ? `home:${selectedProfile.id}` : null, Boolean(selectedProfile) && loadedFor === selectedProfile?.id);

  if (!selectedProfile) return null;
  const allowed = (items: ContentItem[]) => items.filter((item) => item.maturityLevel <= selectedProfile.maturityLevel);
  const byId = new Map(profileMedia.map((item) => [item.id, item]));
  const watchlist = selectedProfile.watchlist.map((id) => byId.get(id)).filter(Boolean) as ContentItem[];
  const continueItems = selectedProfile.history.map((progress) => ({ content: byId.get(progress.mediaId), progress })).filter((item): item is { content: ContentItem; progress: (typeof selectedProfile.history)[number] } => Boolean(item.content) && item.progress.durationSeconds > 0 && item.progress.positionSeconds / item.progress.durationSeconds < 0.95);

  return (
    <div className="space-y-2">
      <ContinueWatchingRow items={continueItems} />
      {watchlist.length > 0 && <MovieRow title={`Ma liste · ${selectedProfile.name}`} movies={toMovies(watchlist)} seeAllHref="/my-list" />}
      {loadingPersonal && activityIds.length > 0 && <RowSkeleton title="Votre sélection" />}
      {error ? <div className="mx-4 mb-8 rounded-xl border border-red-500/20 bg-red-500/[0.06] p-5 text-sm text-red-100 lg:mx-8 xl:mx-10">Certaines sections TMDB n&apos;ont pas pu être chargées. Réessayez dans quelques instants.</div> : <>
        <MovieRow title="Tendances aujourd’hui" movies={toMovies(allowed(sections.trending))} />
        <MovieRow title="Films populaires" movies={toMovies(allowed(sections.popularMovies))} />
        <MovieRow title="Séries populaires" movies={toMovies(allowed(sections.popularSeries))} />
        <MovieRow title="Nouveautés" movies={toMovies(allowed(sections.newReleases))} />
        <MovieRow title="Les mieux notés" movies={toMovies(allowed(sections.topRated))} />
      </>}
      {loadingPersonal ? <RowSkeleton title={`Recommandé pour ${selectedProfile.name}`} /> : recommendations.length > 0 ? <MovieRow title={`Recommandé pour ${selectedProfile.name}`} movies={toMovies(allowed(recommendations))} /> : <section className="mx-4 mb-8 rounded-xl border border-dashed border-white/10 px-5 py-8 text-center lg:mx-8 xl:mx-10"><h2 className="font-bold">Aucune recommandation disponible</h2><p className="mt-1 text-sm text-muted-foreground">Ajoutez des préférences à ce profil pour personnaliser cette section.</p></section>}
    </div>
  );
}
