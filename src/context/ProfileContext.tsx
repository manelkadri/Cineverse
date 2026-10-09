'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import type { CineverseProfile, ProfileDraft } from '@/lib/profile-types';

interface ProfileContextValue {
  profiles: CineverseProfile[];
  selectedProfile: CineverseProfile | null;
  selectedProfileId: string | null;
  ready: boolean;
  persistenceMode: 'database' | 'unavailable';
  error: string | null;
  selectProfile: (id: string | null) => Promise<void>;
  createProfile: (draft: ProfileDraft) => Promise<CineverseProfile>;
  updateProfile: (id: string, draft: ProfileDraft) => Promise<void>;
  deleteProfile: (id: string, parentalPin?: string) => Promise<void>;
  toggleWatchlist: (mediaId: string) => Promise<void>;
  toggleFavorite: (mediaId: string) => Promise<void>;
  updateProgress: (mediaId: string, positionSeconds: number, durationSeconds: number, seasonNumber?: number, episodeNumber?: number) => Promise<void>;
}

const ProfileContext = createContext<ProfileContextValue | null>(null);

async function responseJson<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) throw new Error(payload.error || 'La synchronisation a échoué.');
  return payload;
}

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const { status } = useSession();
  const [profiles, setProfiles] = useState<CineverseProfile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [persistenceMode, setPersistenceMode] = useState<'database' | 'unavailable'>('unavailable');
  const [error, setError] = useState<string | null>(null);

  const hydrateProfiles = useCallback(async () => {
    if (status !== 'authenticated') return;
    try {
      const response = await fetch('/api/profiles', { cache: 'no-store' });
      const payload = await responseJson<{ profiles: CineverseProfile[]; selectedProfileId?: string | null }>(response);
      setProfiles(payload.profiles);
      setSelectedProfileId(payload.selectedProfileId ?? null);
      setPersistenceMode('database');
      setError(null);
    } catch (requestError) {
      setProfiles([]);
      setSelectedProfileId(null);
      setPersistenceMode('unavailable');
      setError(requestError instanceof Error ? requestError.message : 'Base de données indisponible.');
    } finally {
      setReady(true);
    }
  }, [status]);

  useEffect(() => {
    if (status === 'loading') return;
    if (status === 'unauthenticated') {
      setProfiles([]);
      setSelectedProfileId(null);
      setPersistenceMode('unavailable');
      setReady(true);
      return;
    }
    setReady(false);
    void hydrateProfiles();
  }, [hydrateProfiles, status]);

  const selectProfile = useCallback(async (id: string | null) => {
    const previous = selectedProfileId;
    setSelectedProfileId(id);
    try {
      await responseJson(await fetch('/api/profiles/selected', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ profileId: id }) }));
      setError(null);
    } catch (requestError) {
      setSelectedProfileId(previous);
      setError(requestError instanceof Error ? requestError.message : 'Sélection impossible.');
      throw requestError;
    }
  }, [selectedProfileId]);

  const createProfile = useCallback(async (draft: ProfileDraft) => {
    const payload = await responseJson<{ profile: CineverseProfile }>(await fetch('/api/profiles', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...draft, language: 'fr-FR' }),
    }));
    setProfiles((current) => [...current, payload.profile]);
    setError(null);
    return payload.profile;
  }, []);

  const updateProfile = useCallback(async (id: string, draft: ProfileDraft) => {
    const payload = await responseJson<{ profile: CineverseProfile }>(await fetch(`/api/profiles/${encodeURIComponent(id)}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...draft, language: 'fr-FR' }),
    }));
    setProfiles((current) => current.map((profile) => profile.id === id ? payload.profile : profile));
    setError(null);
  }, []);

  const deleteProfile = useCallback(async (id: string, parentalPin?: string) => {
    await responseJson(await fetch(`/api/profiles/${encodeURIComponent(id)}`, {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ parentalPin }),
    }));
    setProfiles((current) => current.filter((profile) => profile.id !== id));
    if (selectedProfileId === id) setSelectedProfileId(null);
    setError(null);
  }, [selectedProfileId]);

  const updateCollection = useCallback(async (collection: 'watchlist' | 'favorites', mediaId: string) => {
    const profile = profiles.find((item) => item.id === selectedProfileId);
    if (!profile) return;
    const current = profile[collection];
    const removing = current.includes(mediaId);
    setProfiles((items) => items.map((item) => item.id === profile.id ? { ...item, [collection]: removing ? current.filter((id) => id !== mediaId) : [...current, mediaId] } : item));
    try {
      await responseJson(await fetch(`/api/profiles/${encodeURIComponent(profile.id)}/${collection}`, {
        method: removing ? 'DELETE' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mediaId }),
      }));
      setError(null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Synchronisation impossible.');
      await hydrateProfiles();
      throw requestError;
    }
  }, [hydrateProfiles, profiles, selectedProfileId]);

  const toggleWatchlist = useCallback((mediaId: string) => updateCollection('watchlist', mediaId), [updateCollection]);
  const toggleFavorite = useCallback((mediaId: string) => updateCollection('favorites', mediaId), [updateCollection]);

  const updateProgress = useCallback(async (mediaId: string, positionSeconds: number, durationSeconds: number, seasonNumber?: number, episodeNumber?: number) => {
    if (!selectedProfileId) return;
    const payload = { mediaId, positionSeconds, durationSeconds, seasonNumber: seasonNumber ?? null, episodeNumber: episodeNumber ?? null };
    await responseJson(await fetch(`/api/profiles/${encodeURIComponent(selectedProfileId)}/history`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    }));
    await hydrateProfiles();
  }, [hydrateProfiles, selectedProfileId]);

  const selectedProfile = profiles.find((profile) => profile.id === selectedProfileId) ?? null;
  const value = useMemo(() => ({
    profiles, selectedProfile, selectedProfileId, ready, persistenceMode, error, selectProfile,
    createProfile, updateProfile, deleteProfile, toggleWatchlist, toggleFavorite, updateProgress,
  }), [profiles, selectedProfile, selectedProfileId, ready, persistenceMode, error, selectProfile, createProfile, updateProfile, deleteProfile, toggleWatchlist, toggleFavorite, updateProgress]);

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfiles() {
  const context = useContext(ProfileContext);
  if (!context) throw new Error('useProfiles must be used inside ProfileProvider');
  return context;
}
