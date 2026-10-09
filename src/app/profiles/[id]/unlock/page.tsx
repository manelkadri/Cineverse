'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { AlertCircle, ArrowLeft, WifiOff } from 'lucide-react';
import CineverseLogo from '@/components/CineverseLogo';
import LoadingPosterColumns from '@/components/LoadingPosterColumns';
import PinCodeInput, { type PinCodeInputHandle } from '@/components/PinCodeInput';
import ProfileAvatar from '@/components/ProfileAvatar';
import { useCinematicTransition } from '@/components/CinematicTransitionProvider';
import { PinError, useProfiles } from '@/context/ProfileContext';
import { PIN_LENGTH, pinProblem } from '@/lib/pin-rules';

type Problem = { kind: 'incorrect' | 'locked' | 'network' | 'invalid'; text: string };

function Backdrop() {
  return (
    <>
      <LoadingPosterColumns />
      <div className="cv-loading__vignette" aria-hidden="true" />
      <div className="cv-loading__glow" aria-hidden="true" />
    </>
  );
}

export default function UnlockProfilePage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const profileId = decodeURIComponent(String(params?.id ?? ''));
  const { begin: beginCinematicTransition } = useCinematicTransition();
  const { profiles, ready, selectedProfileId, unlockProfile, setProfilePin, refreshProfiles } = useProfiles();
  const profile = profiles.find((item) => item.id === profileId) ?? null;

  const inputRef = useRef<PinCodeInputHandle>(null);
  const submitting = useRef(false);
  const [pin, setPin] = useState('');
  const [firstPin, setFirstPin] = useState(''); // setup mode: the PIN to be confirmed
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [shake, setShake] = useState(false);
  const [lockedUntil, setLockedUntil] = useState(0);
  const [focusTick, setFocusTick] = useState(0);

  const setupMode = Boolean(profile && !profile.hasPin);
  const confirming = setupMode && firstPin.length === PIN_LENGTH;
  const disabled = busy || done || lockedUntil > Date.now();

  // Unknown profile (deleted, or another account's id): back to the picker, nothing is revealed.
  useEffect(() => {
    if (ready && !profile) router.replace('/profiles');
  }, [profile, ready, router]);

  // The profile that is already unlocked in this session needs no second PIN.
  useEffect(() => {
    if (ready && profile && !profile.locked && selectedProfileId === profile.id && !submitting.current) router.replace('/');
  }, [profile, ready, router, selectedProfileId]);

  // After every failed attempt (and once the screen is ready) the field is enabled again and focused.
  useEffect(() => {
    if (!disabled && ready && profile) inputRef.current?.focus();
  }, [disabled, ready, profile, focusTick, confirming]);

  // A lockout ends by itself: the field re-enables and the message goes away.
  useEffect(() => {
    if (lockedUntil <= Date.now()) return;
    const timer = window.setTimeout(() => { setLockedUntil(0); setProblem(null); setFocusTick((tick) => tick + 1); }, lockedUntil - Date.now() + 50);
    return () => window.clearTimeout(timer);
  }, [lockedUntil]);

  const fail = useCallback((next: Problem) => {
    setProblem(next);
    setPin('');
    setBusy(false);
    setShake(true);
    window.setTimeout(() => setShake(false), 480);
    setFocusTick((tick) => tick + 1);
  }, []);

  const succeed = useCallback((id: string) => {
    setDone(true); // stays busy: the cinematic loader takes over, only after the server accepted the PIN
    beginCinematicTransition(`home:${id}`, '/');
  }, [beginCinematicTransition]);

  const verify = useCallback(async (code: string) => {
    if (!profile || submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setProblem(null);
    try {
      await unlockProfile(profile.id, code);
      succeed(profile.id);
    } catch (error) {
      submitting.current = false;
      if (error instanceof PinError && error.code === 'PIN_INCORRECT') fail({ kind: 'incorrect', text: 'Code PIN incorrect' });
      else if (error instanceof PinError && error.code === 'PIN_LOCKED') {
        setLockedUntil(Date.now() + Math.max(1, error.retryAfterSeconds ?? 60) * 1000);
        fail({ kind: 'locked', text: error.message });
      } else if (error instanceof PinError && error.code === 'PIN_SETUP_REQUIRED') { setBusy(false); void refreshProfiles(); }
      else if (error instanceof PinError && error.code === 'NETWORK') fail({ kind: 'network', text: error.message });
      else fail({ kind: 'invalid', text: 'Vérification impossible pour le moment. Réessayez.' });
    }
  }, [fail, profile, refreshProfiles, succeed, unlockProfile]);

  const setup = useCallback(async (first: string, confirm: string) => {
    if (!profile || submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setProblem(null);
    try {
      await setProfilePin(profile.id, first, confirm);
      succeed(profile.id);
    } catch (error) {
      submitting.current = false;
      setFirstPin('');
      if (error instanceof PinError && error.code === 'NETWORK') fail({ kind: 'network', text: error.message });
      else fail({ kind: 'invalid', text: error instanceof Error ? error.message : 'Enregistrement impossible. Réessayez.' });
    }
  }, [fail, profile, setProfilePin, succeed]);

  const onChange = (value: string) => {
    if (disabled) return;
    setPin(value);
    if (problem) setProblem(null);
    if (value.length !== PIN_LENGTH) return;
    if (!setupMode) { void verify(value); return; }
    if (!confirming) {
      const weak = pinProblem(value);
      if (weak) { fail({ kind: 'invalid', text: weak }); return; }
      setFirstPin(value);
      setPin('');
      return;
    }
    if (value !== firstPin) {
      setFirstPin('');
      fail({ kind: 'invalid', text: 'Les deux codes ne correspondent pas. Recommencez.' });
      return;
    }
    void setup(firstPin, value);
  };

  if (!ready || !profile) {
    return (
      <main className="cv-pin-screen grid place-items-center">
        <Backdrop />
        <div className="cv-pin-spinner relative z-[1]" role="status" aria-label="Chargement" />
      </main>
    );
  }

  const heading = !setupMode ? 'Entrez votre code PIN' : confirming ? 'Confirmez votre code PIN' : 'Créez votre code PIN';
  const subtitle = !setupMode
    ? 'Saisissez les 4 chiffres pour ouvrir ce profil.'
    : confirming
      ? 'Saisissez à nouveau les 4 chiffres pour confirmer.'
      : 'Ce profil n’a pas encore de code. Choisissez 4 chiffres pour le protéger.';

  return (
    <main className="cv-pin-screen">
      <Backdrop />
      <div className="cv-pin-screen__center">
        <Link href="/profiles" aria-label="CINEVERSE" className="leading-none"><CineverseLogo as="div" className="cv-pin-logo" /></Link>

        <section className="cv-pin-card" aria-labelledby="pin-heading" data-testid="pin-card">
          <div className="cv-pin-avatar"><ProfileAvatar avatar={profile.avatar} name={profile.name} className="size-full" /></div>
          <p className="mt-3 truncate text-lg font-bold" data-testid="pin-profile-name">{profile.name}</p>
          <h1 id="pin-heading" className="mt-5 text-xl font-extrabold tracking-tight sm:text-2xl">{heading}</h1>
          <p id="pin-subtitle" className="mt-1.5 text-sm text-[#a9a9b1]">{subtitle}</p>

          <div className="mt-6">
            <PinCodeInput
              ref={inputRef}
              id="profile-pin"
              label={heading}
              value={pin}
              onChange={onChange}
              disabled={disabled}
              invalid={problem?.kind === 'incorrect' || problem?.kind === 'locked'}
              shake={shake}
              autoFocus
              describedBy={problem ? 'pin-problem pin-subtitle' : 'pin-subtitle'}
            />
          </div>

          <div className="mt-4 flex min-h-[3.25rem] items-start justify-center" aria-live="polite">
            {busy && !problem && <span className="cv-pin-spinner mt-1" role="status" aria-label="Vérification en cours" />}
            {problem && (
              <p id="pin-problem" role="alert" className={`flex items-start gap-2 text-left text-sm font-semibold ${problem.kind === 'network' ? 'text-amber-300' : 'text-[#ff4d58]'}`}>
                {problem.kind === 'network' ? <WifiOff size={17} className="mt-px shrink-0" aria-hidden="true" /> : <AlertCircle size={17} className="mt-px shrink-0" aria-hidden="true" />}
                <span>{problem.text}</span>
              </p>
            )}
          </div>
        </section>

        <Link href="/profiles" className="inline-flex items-center gap-2 text-sm font-semibold text-[#9a9aa3] transition-colors hover:text-white focus-visible:text-white">
          <ArrowLeft size={16} aria-hidden="true" /> Retour aux profils
        </Link>
      </div>
    </main>
  );
}
