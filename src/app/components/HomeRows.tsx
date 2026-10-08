'use client';

import React, { useEffect, useMemo, useState } from 'react';
import MovieRow from '@/components/MovieRow';
import ContinueWatchingRow from '@/components/ContinueWatchingRow';
import { useProfiles } from '@/context/ProfileContext';
import { CONTENT_CATALOG, getContent, getRecommendations } from '@/lib/content';
import type { ContentItem } from '@/lib/profile-types';

export default function HomeRows() {
  const { selectedProfile } = useProfiles();
  const fallbackRecommendations = useMemo(() => getRecommendations(selectedProfile, 10), [selectedProfile]);
  const [recommendations, setRecommendations] = useState<ContentItem[]>(fallbackRecommendations);

  useEffect(() => {
    setRecommendations(fallbackRecommendations);
    if (!selectedProfile) return;
    const controller = new AbortController();
    fetch('/api/recommendations', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(selectedProfile), signal: controller.signal,
    }).then((response) => response.ok ? response.json() : null)
      .then((payload) => { if (payload?.recommendations) setRecommendations(payload.recommendations); })
      .catch(() => undefined);
    return () => controller.abort();
  }, [fallbackRecommendations, selectedProfile]);
  if (!selectedProfile) return null;

  const allowed = CONTENT_CATALOG.filter((item) => item.maturityLevel <= selectedProfile.maturityLevel);
  const watchlist = getContent(selectedProfile.watchlist, selectedProfile);
  const continueItems = selectedProfile.history
    .filter((progress) => progress.durationSeconds > 0 && progress.positionSeconds / progress.durationSeconds < 0.95)
    .map((progress) => ({ content: allowed.find((item) => item.id === progress.mediaId), progress }))
    .filter((item): item is { content: (typeof allowed)[number]; progress: (typeof selectedProfile.history)[number] } => Boolean(item.content));

  const toMovies = (items: typeof allowed) => items.map((item) => ({
    id: item.id, title: item.title, posterPath: item.posterPath, year: item.year,
    rating: item.rating, mediaType: item.mediaType,
  }));

  return (
    <div className="space-y-2">
      <ContinueWatchingRow items={continueItems} />
      {watchlist.length > 0 && <MovieRow title={`Ma liste · ${selectedProfile.name}`} movies={toMovies(watchlist)} seeAllHref="/my-list" />}
      <MovieRow title={selectedProfile.isKids ? 'Populaires pour les enfants' : "Tendances aujourd'hui"} movies={toMovies(allowed.slice(0, 10))} />
      <MovieRow title={`Recommandé pour ${selectedProfile.name}`} movies={toMovies(recommendations)} />
      <MovieRow title="Les mieux notés" movies={toMovies([...allowed].sort((a, b) => b.rating - a.rating).slice(0, 10))} />
    </div>
  );
}
