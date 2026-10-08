'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { DEFAULT_PROFILES } from '@/lib/default-profiles';
import type { CineverseProfile, ProfileDraft } from '@/lib/profile-types';

const STORAGE_KEY = 'cineverse.profile-state.v3';
const SELECTED_KEY = 'cineverse.selected-profile.v3';

interface ProfileContextValue {
  profiles: CineverseProfile[];
  selectedProfile: CineverseProfile | null;
  selectedProfileId: string | null;
  ready: boolean;
  persistenceMode: 'database' | 'local';
  selectProfile: (id: string | null) => void;
  createProfile: (draft: ProfileDraft) => CineverseProfile;
  updateProfile: (id: string, draft: ProfileDraft) => void;
  deleteProfile: (id: string) => void;
  toggleWatchlist: (mediaId: string) => void;
  toggleFavorite: (mediaId: string) => void;
  updateProgress: (mediaId: string, positionSeconds: number, durationSeconds: number) => void;
}

const ProfileContext = createContext<ProfileContextValue | null>(null);

function cloneDefaults() {
  return DEFAULT_PROFILES.map((profile) => ({
    ...profile,
    preferences: [...profile.preferences],
    watchlist: [...profile.watchlist],
    favorites: [...profile.favorites],
    history: profile.history.map((item) => ({ ...item })),
  }));
}

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const [profiles, setProfiles] = useState<CineverseProfile[]>(cloneDefaults);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [persistenceMode, setPersistenceMode] = useState<'database' | 'local'>('local');

  useEffect(() => {
    let cancelled = false;
    const hydrate = async () => {
      const storedProfiles = window.localStorage.getItem(STORAGE_KEY);
      const storedSelected = window.localStorage.getItem(SELECTED_KEY);
      if (storedProfiles) {
        try {
          setProfiles(JSON.parse(storedProfiles) as CineverseProfile[]);
        } catch {
          setProfiles(cloneDefaults());
        }
      }
      if (storedSelected) setSelectedProfileId(storedSelected);

      try {
        const response = await fetch('/api/profiles', { cache: 'no-store' });
        if (response.ok) {
          const payload = (await response.json()) as { profiles: CineverseProfile[]; selectedProfileId?: string | null };
          if (!cancelled) {
            setProfiles(payload.profiles);
            setSelectedProfileId(payload.selectedProfileId ?? null);
            setPersistenceMode('database');
          }
        }
      } catch {
        // Local persistence remains active when PostgreSQL is not configured.
      } finally {
        if (!cancelled) setReady(true);
      }
    };
    hydrate();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!ready) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
  }, [profiles, ready]);

  useEffect(() => {
    if (!ready) return;
    if (selectedProfileId) window.localStorage.setItem(SELECTED_KEY, selectedProfileId);
    else window.localStorage.removeItem(SELECTED_KEY);
  }, [selectedProfileId, ready]);

  const syncProfile = useCallback(async (profile: CineverseProfile, parentalPin?: string) => {
    if (persistenceMode !== 'database') return;
    try {
      await fetch('/api/profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...profile, parentalPin }),
      });
    } catch {
      // The optimistic local state remains available during a transient backend failure.
    }
  }, [persistenceMode]);

  const selectProfile = useCallback((id: string | null) => {
    setSelectedProfileId(id);
    if (persistenceMode === 'database') {
      fetch('/api/profiles/selected', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId: id }),
      }).catch(() => undefined);
    }
  }, [persistenceMode]);

  const createProfile = useCallback((draft: ProfileDraft) => {
    const profile: CineverseProfile = {
      id: `profile-${crypto.randomUUID()}`,
      name: draft.name.trim(),
      avatar: draft.avatar,
      isKids: draft.isKids,
      maturityLevel: draft.isKids ? Math.min(draft.maturityLevel, 10) : draft.maturityLevel,
      preferences: draft.preferences,
      watchlist: [],
      favorites: [],
      history: [],
    };
    setProfiles((current) => [...current, profile]);
    void syncProfile(profile, draft.parentalPin);
    return profile;
  }, [syncProfile]);

  const updateProfile = useCallback((id: string, draft: ProfileDraft) => {
    setProfiles((current) => current.map((profile) => {
      if (profile.id !== id) return profile;
      const updated = {
        ...profile,
        name: draft.name.trim(),
        avatar: draft.avatar,
        isKids: draft.isKids,
        maturityLevel: draft.isKids ? Math.min(draft.maturityLevel, 10) : draft.maturityLevel,
        preferences: draft.preferences,
      };
      void syncProfile(updated, draft.parentalPin);
      return updated;
    }));
  }, [syncProfile]);

  const deleteProfile = useCallback((id: string) => {
    setProfiles((current) => current.filter((profile) => profile.id !== id));
    if (selectedProfileId === id) setSelectedProfileId(null);
    if (persistenceMode === 'database') {
      fetch(`/api/profiles/${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(() => undefined);
    }
  }, [persistenceMode, selectedProfileId]);

  const updateSelected = useCallback((updater: (profile: CineverseProfile) => CineverseProfile) => {
    if (!selectedProfileId) return;
    setProfiles((current) => current.map((profile) => {
      if (profile.id !== selectedProfileId) return profile;
      const updated = updater(profile);
      void syncProfile(updated);
      return updated;
    }));
  }, [selectedProfileId, syncProfile]);

  const toggleWatchlist = useCallback((mediaId: string) => {
    updateSelected((profile) => ({
      ...profile,
      watchlist: profile.watchlist.includes(mediaId)
        ? profile.watchlist.filter((id) => id !== mediaId)
        : [...profile.watchlist, mediaId],
    }));
  }, [updateSelected]);

  const toggleFavorite = useCallback((mediaId: string) => {
    updateSelected((profile) => ({
      ...profile,
      favorites: profile.favorites.includes(mediaId)
        ? profile.favorites.filter((id) => id !== mediaId)
        : [...profile.favorites, mediaId],
    }));
  }, [updateSelected]);

  const updateProgress = useCallback((mediaId: string, positionSeconds: number, durationSeconds: number) => {
    updateSelected((profile) => ({
      ...profile,
      history: [
        { mediaId, positionSeconds, durationSeconds, updatedAt: new Date().toISOString() },
        ...profile.history.filter((item) => item.mediaId !== mediaId),
      ],
    }));
  }, [updateSelected]);

  const selectedProfile = profiles.find((profile) => profile.id === selectedProfileId) ?? null;
  const value = useMemo(() => ({
    profiles, selectedProfile, selectedProfileId, ready, persistenceMode, selectProfile,
    createProfile, updateProfile, deleteProfile, toggleWatchlist, toggleFavorite, updateProgress,
  }), [profiles, selectedProfile, selectedProfileId, ready, persistenceMode, selectProfile, createProfile, updateProfile, deleteProfile, toggleWatchlist, toggleFavorite, updateProgress]);

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfiles() {
  const context = useContext(ProfileContext);
  if (!context) throw new Error('useProfiles must be used inside ProfileProvider');
  return context;
}
