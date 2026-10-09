'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import CineverseLogo from '@/components/CineverseLogo';
import LoadingPosterColumns from '@/components/LoadingPosterColumns';
import { COMPLETE_MS, FADE_MS, HOLD_MS, STALL_MS, completingProgress, quantizeProgress, runningProgress } from '@/lib/cinematic-progress';

// The cinematic CINEVERSE intro. It is NOT a Suspense fallback and is not tied to route changes: it plays only
// when something calls `begin()`, which the profile selection screen does after a profile was successfully chosen.
// The provider sits in the root layout, so the overlay survives the navigation it covers.
//
// Lifecycle: idle -> running (bar eases toward, but never reaches, 90%) -> completing (bar travels the rest of the
// way to exactly 100% once the destination reports it is ready) -> holding (finished bar stays visible) ->
// leaving (fade out) -> idle. If the destination never becomes ready it goes to `stalled`, which shows a recovery
// path instead of waiting forever. The percentage is a visual indicator, not a measured download.
type Phase = 'idle' | 'running' | 'completing' | 'holding' | 'leaving' | 'stalled';

interface CinematicTransitionApi {
  /** Starts the intro and navigates to `destination`. Returns false (and does nothing) if one is already playing. */
  begin: (readyKey: string, destination?: string) => boolean;
  /** Called by the destination when the data the transition waits for is ready. */
  reportReady: (key: string) => void;
}

const noop: CinematicTransitionApi = { begin: () => false, reportReady: () => undefined };
const CinematicTransitionContext = createContext<CinematicTransitionApi>(noop);

export const useCinematicTransition = () => useContext(CinematicTransitionContext);

/** Tells an active cinematic transition that `key` is ready (for example the homepage data of a profile). */
export function useTransitionReady(key: string | null, ready: boolean) {
  const { reportReady } = useCinematicTransition();
  useEffect(() => {
    if (key && ready) reportReady(key);
  }, [key, ready, reportReady]);
}

const prefersReducedMotion = () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export default function CinematicTransitionProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [phase, setPhase] = useState<Phase>('idle');
  const [readyVersion, setReadyVersion] = useState(0);

  const phaseRef = useRef<Phase>('idle');
  const fillRef = useRef<HTMLSpanElement | null>(null);
  const retryRef = useRef<HTMLButtonElement | null>(null);
  const requiredKey = useRef<string | null>(null);
  const destination = useRef('/');
  const readyKeys = useRef(new Set<string>());
  const progress = useRef(0); // the value currently shown, 0..1, only ever increases during one transition
  const startedAt = useRef(0);
  const completeAt = useRef(0);
  const progressAtComplete = useRef(0);
  const frame = useRef<number | null>(null);
  const timers = useRef<{ stall?: number; hold?: number; leave?: number }>({});

  const changePhase = useCallback((next: Phase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  const clearTimers = useCallback(() => {
    window.clearTimeout(timers.current.stall);
    window.clearTimeout(timers.current.hold);
    window.clearTimeout(timers.current.leave);
    timers.current = {};
  }, []);

  const paint = useCallback((value: number) => {
    progress.current = value;
    const shown = prefersReducedMotion() ? quantizeProgress(value) : value;
    if (fillRef.current) fillRef.current.style.transform = `scaleX(${shown})`;
  }, []);

  const finish = useCallback(() => {
    clearTimers();
    if (frame.current !== null) cancelAnimationFrame(frame.current);
    frame.current = null;
    requiredKey.current = null;
    readyKeys.current.clear();
    changePhase('idle');
  }, [changePhase, clearTimers]);

  const leave = useCallback(() => {
    changePhase('leaving');
    window.clearTimeout(timers.current.leave);
    timers.current.leave = window.setTimeout(finish, prefersReducedMotion() ? 0 : FADE_MS);
  }, [changePhase, finish]);

  const armStall = useCallback(() => {
    window.clearTimeout(timers.current.stall);
    timers.current.stall = window.setTimeout(() => {
      if (phaseRef.current === 'running') changePhase('stalled');
    }, STALL_MS);
  }, [changePhase]);

  const startCompleting = useCallback(() => {
    window.clearTimeout(timers.current.stall);
    progressAtComplete.current = progress.current;
    completeAt.current = performance.now();
    changePhase('completing');
    if (prefersReducedMotion()) {
      paint(1);
      changePhase('holding');
      timers.current.hold = window.setTimeout(leave, 150);
    }
  }, [changePhase, leave, paint]);

  const begin = useCallback((readyKey: string, target = '/') => {
    if (phaseRef.current !== 'idle') return false; // never two overlays, never a restart
    clearTimers();
    readyKeys.current.clear();
    requiredKey.current = readyKey;
    destination.current = target;
    progress.current = 0;
    startedAt.current = performance.now();
    changePhase('running');
    armStall();
    router.push(target);
    return true;
  }, [armStall, changePhase, clearTimers, router]);

  const reportReady = useCallback((key: string) => {
    if (phaseRef.current === 'idle') return;
    if (readyKeys.current.has(key)) return;
    readyKeys.current.add(key);
    setReadyVersion((value) => value + 1);
  }, []);

  // The destination counts as ready when we are on it and it has reported the data we were waiting for.
  useEffect(() => {
    if (phase !== 'running' && phase !== 'stalled') return;
    const key = requiredKey.current;
    if (key && pathname === destination.current && readyKeys.current.has(key)) startCompleting();
  }, [phase, pathname, readyVersion, startCompleting]);

  // If the user leaves for somewhere unrelated while it plays (for example browser Back), drop the intro.
  useEffect(() => {
    if (phase === 'idle' || phase === 'leaving') return;
    if (pathname !== destination.current && pathname !== '/profiles') finish();
  }, [phase, pathname, finish]);

  // One animation loop per transition; it only touches the bar element, never React state.
  const active = phase !== 'idle';
  useEffect(() => {
    if (!active) return;
    const tick = (now: number) => {
      const current = phaseRef.current;
      if (current === 'running') {
        paint(Math.max(progress.current, runningProgress(now - startedAt.current)));
      } else if (current === 'completing') {
        const next = Math.max(progress.current, completingProgress(progressAtComplete.current, now - completeAt.current));
        paint(next);
        if (next >= 1 && now - completeAt.current >= COMPLETE_MS) {
          paint(1);
          changePhase('holding');
          timers.current.hold = window.setTimeout(leave, HOLD_MS);
        }
      }
      frame.current = requestAnimationFrame(tick);
    };
    paint(progress.current);
    frame.current = requestAnimationFrame(tick);
    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
      frame.current = null;
    };
  }, [active, changePhase, leave, paint]);

  useEffect(() => () => {
    clearTimers();
    if (frame.current !== null) cancelAnimationFrame(frame.current);
  }, [clearTimers]);

  useEffect(() => {
    if (phase === 'stalled') retryRef.current?.focus();
  }, [phase]);

  // A real retry: the profile is already saved server-side, so reloading the destination re-runs every request that stalled.
  const retry = useCallback(() => {
    if (phaseRef.current !== 'stalled') return;
    const target = destination.current;
    finish();
    window.location.assign(target);
  }, [finish]);

  const backToProfiles = useCallback(() => {
    finish();
    router.push('/profiles');
  }, [finish, router]);

  const api = useMemo<CinematicTransitionApi>(() => ({ begin, reportReady }), [begin, reportReady]);
  const done = phase === 'completing' && progress.current >= 1 ? true : phase === 'holding' || phase === 'leaving';

  return (
    <CinematicTransitionContext.Provider value={api}>
      {children}
      {active && (
        <div
          className={`cv-loading${phase === 'leaving' ? ' cv-loading--leaving' : ''}`}
          role="status"
          aria-live="polite"
          aria-label="Chargement de CINEVERSE"
          data-cinematic-transition
          data-phase={phase}
        >
          <LoadingPosterColumns />
          <div className="cv-loading__vignette" aria-hidden="true" />
          <div className="cv-loading__glow" aria-hidden="true" />
          <div className="cv-loading__center">
            <div className="cv-loading__brand" style={{ position: 'relative' }}>
              <CineverseLogo className="cv-loading__logo" />
              <div className={`cv-bar${done ? ' cv-bar--done' : ''}`} role="progressbar" aria-label="Chargement en cours">
                <span className="cv-bar__fill" ref={fillRef} />
                <span className="cv-bar__flash" />
              </div>
              {phase === 'stalled' && (
                <div role="alert" className="absolute left-1/2 top-full mt-8 w-[min(86vw,22rem)] -translate-x-1/2 text-center">
                  <p className="text-sm text-white/80">Le chargement prend plus de temps que prévu.</p>
                  <div className="mt-4 flex justify-center gap-3">
                    <button ref={retryRef} type="button" onClick={retry} className="rounded-md bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-primary-hover">Réessayer</button>
                    <button type="button" onClick={backToProfiles} className="rounded-md border border-white/30 px-4 py-2 text-sm font-bold text-white hover:bg-white/10">Retour aux profils</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </CinematicTransitionContext.Provider>
  );
}
