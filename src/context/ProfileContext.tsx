'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import type { CineverseProfile, ProfileDraft, ProfileUpdate } from '@/lib/profile-types';

export type PinErrorCode = 'PIN_INCORRECT' | 'PIN_LOCKED' | 'PIN_SETUP_REQUIRED' | 'PIN_FORMAT' | 'PASSWORD_INCORRECT' | 'NETWORK' | 'UNKNOWN';

const KNOWN_PIN_CODES: PinErrorCode[] = ['PIN_INCORRECT', 'PIN_LOCKED', 'PIN_SETUP_REQUIRED', 'PIN_FORMAT', 'PASSWORD_INCORRECT'];

/** A PIN-related failure with a stable code the lock screen reacts to (never carries the PIN or a hint about it). */
export class PinError extends Error {
  code: PinErrorCode;
  retryAfterSeconds?: number;
  constructor(code: PinErrorCode, message: string, retryAfterSeconds?: number) {
    super(message);
    this.code = code;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

interface ProfileContextValue {
  profiles: CineverseProfile[];
  /** The profile unlocked in this login session, if any. */
  selectedProfile: CineverseProfile | null;
  selectedProfileId: string | null;
  ready: boolean;
  persistenceMode: 'database' | 'unavailable';
  error: string | null;
  /** Verifies the PIN on the server; on success the profile is unlocked and selected. */
  unlockProfile: (id: string, pin: string) => Promise<CineverseProfile>;
  /** First PIN for a profile without one (no password needed), or a PIN change (account password required). */
  setProfilePin: (id: string, pin: string, confirmPin: string, password?: string) => Promise<CineverseProfile | null>;
  /** Leaves the current profile: clears the selection and the unlock. */
  clearSelectedProfile: () => Promise<void>;
  createProfile: (draft: ProfileDraft) => Promise<CineverseProfile>;
  updateProfile: (id: string, draft: ProfileUpdate, password: string) => Promise<void>;
  deleteProfile: (id: string, password: string, parentalPin?: string) => Promise<void>;
  toggleWatchlist: (mediaId: string) => Promise<void>;
  toggleFavorite: (mediaId: string) => Promise<void>;
  updateProgress: (mediaId: string, positionSeconds: number, durationSeconds: number, seasonNumber?: number, episodeNumber?: number) => Promise<void>;
  refreshProfiles: () => Promise<void>;
}

const ProfileContext = createContext<ProfileContextValue | null>(null);

const JSON_HEADERS = { 'Content-Type': 'application/json' };

async function responseJson<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) throw new Error(payload.error || 'La synchronisation a échoué.');
  return payload;
}

/** Like responseJson, but maps the server's PIN error codes to a PinError and network failures to code NETWORK. */
async function pinRequest<T>(input: string, init: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(input, init);
  } catch {
    throw new PinError('NETWORK', 'Connexion impossible. Vérifiez votre réseau et réessayez.');
  }
  const payload = await response.json().catch(() => ({})) as T & { error?: string; code?: string; retryAfterSeconds?: number };
  if (!response.ok) {
    const code = KNOWN_PIN_CODES.find((known) => known === payload.code) ?? 'UNKNOWN';
    throw new PinError(code, payload.error || 'Une erreur est survenue. Réessayez.', payload.retryAfterSeconds);
  }
  return payload;
}

/** The client-side shape of a profile that is not unlocked: identity only, no personal data. */
function relock(profile: CineverseProfile): CineverseProfile {
  return profile.locked ? profile : { ...profile, locked: true, watchlist: [], favorites: [], history: [], preferences: [] };
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

  const unlockProfile = useCallback(async (id: string, pin: string) => {
    const payload = await pinRequest<{ profile: CineverseProfile; selectedProfileId: string }>(`/api/profiles/${encodeURIComponent(id)}/unlock`, {
      method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ pin }),
    });
    // One profile is unlocked per session: unlocking this one puts the others back to their locked, data-free state.
    setProfiles((current) => current.map((profile) => profile.id === id ? payload.profile : relock(profile)));
    setSelectedProfileId(payload.selectedProfileId);
    setError(null);
    return payload.profile;
  }, []);

  const setProfilePin = useCallback(async (id: string, pin: string, confirmPin: string, password?: string) => {
    const payload = await pinRequest<{ profile?: CineverseProfile; selectedProfileId?: string }>(`/api/profiles/${encodeURIComponent(id)}/pin`, {
      method: 'PUT', headers: JSON_HEADERS, body: JSON.stringify({ pin, confirmPin, password }),
    });
    const unlocked = payload.profile ?? null;
    if (unlocked) {
      setProfiles((current) => current.map((profile) => profile.id === id ? unlocked : relock(profile)));
      if (payload.selectedProfileId) setSelectedProfileId(payload.selectedProfileId);
    } else {
      setProfiles((current) => current.map((profile) => profile.id === id ? { ...profile, hasPin: true } : profile));
    }
    return unlocked;
  }, []);

  const clearSelectedProfile = useCallback(async () => {
    await responseJson(await fetch('/api/profiles/selected', { method: 'PUT', headers: JSON_HEADERS, body: JSON.stringify({ profileId: null }) }));
    setSelectedProfileId(null);
    setProfiles((current) => current.map(relock));
    setError(null);
  }, []);

  const createProfile = useCallback(async (draft: ProfileDraft) => {
    const payload = await responseJson<{ profile: CineverseProfile }>(await fetch('/api/profiles', {
      method: 'POST', headers: JSON_HEADERS, body: JSON.stringify({ ...draft, language: 'fr-FR' }),
    }));
    setProfiles((current) => [...current, payload.profile]);
    setError(null);
    return payload.profile;
  }, []);

  const updateProfile = useCallback(async (id: string, draft: ProfileUpdate, password: string) => {
    const fields = { ...draft };
    delete fields.pin;
    delete fields.confirmPin;
    const payload = await responseJson<{ profile: CineverseProfile }>(await fetch(`/api/profiles/${encodeURIComponent(id)}`, {
      method: 'PATCH', headers: JSON_HEADERS, body: JSON.stringify({ ...fields, language: 'fr-FR', password }),
    }));
    setProfiles((current) => current.map((profile) => profile.id === id ? payload.profile : profile));
    setError(null);
  }, []);

  const deleteProfile = useCallback(async (id: string, password: string, parentalPin?: string) => {
    await responseJson(await fetch(`/api/profiles/${encodeURIComponent(id)}`, {
      method: 'DELETE', headers: JSON_HEADERS, body: JSON.stringify({ password, parentalPin: parentalPin || undefined }),
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
        method: removing ? 'DELETE' : 'POST', headers: JSON_HEADERS, body: JSON.stringify({ mediaId }),
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
      method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(payload),
    }));
    await hydrateProfiles();
  }, [hydrateProfiles, selectedProfileId]);

  const selectedProfile = profiles.find((profile) => profile.id === selectedProfileId && !profile.locked) ?? null;
  const value = useMemo(() => ({
    profiles, selectedProfile, selectedProfileId, ready, persistenceMode, error, unlockProfile, setProfilePin, clearSelectedProfile,
    refreshProfiles: hydrateProfiles, createProfile, updateProfile, deleteProfile, toggleWatchlist, toggleFavorite, updateProgress,
  }), [profiles, selectedProfile, selectedProfileId, ready, persistenceMode, error, unlockProfile, setProfilePin, clearSelectedProfile, hydrateProfiles, createProfile, updateProfile, deleteProfile, toggleWatchlist, toggleFavorite, updateProgress]);

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfiles() {
  const context = useContext(ProfileContext);
  if (!context) throw new Error('useProfiles must be used inside ProfileProvider');
  return context;
}
