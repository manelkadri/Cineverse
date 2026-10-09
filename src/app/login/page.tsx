'use client';

import React, { useEffect, useState } from 'react';
import { signIn } from 'next-auth/react';
import CineverseLogo from '@/components/CineverseLogo';
import { Eye, EyeOff, LockKeyhole, Mail, ShieldCheck, UserRound } from 'lucide-react';

type Mode = 'login' | 'register';

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [configured, setConfigured] = useState<boolean | null>(null);

  useEffect(() => {
    fetch('/api/auth/status', { cache: 'no-store' })
      .then((response) => response.json())
      .then((payload) => setConfigured(Boolean(payload.configured)))
      .catch(() => setConfigured(false));
    const query = new URLSearchParams(window.location.search);
    if (query.get('reason') === 'expired') setMessage('Votre session a expiré. Reconnectez-vous pour retrouver vos profils.');
    // Someone who is already signed in does not log in again: they continue to where they were going (the profile screen unless
    // a profile is already unlocked). Only a session the server confirms counts; an expired or unverifiable one keeps the form.
    let cancelled = false;
    fetch('/api/session/state', { cache: 'no-store' })
      .then((response) => response.json())
      .then((payload: { state?: string }) => {
        if (cancelled || payload.state !== 'authenticated') return;
        // "/" lets the existing gate decide: the homepage when a profile is unlocked, the profile screen otherwise
        let target = '/';
        try {
          const wanted = new URL(query.get('callbackUrl') || '/', window.location.origin);
          if (wanted.origin === window.location.origin && !wanted.pathname.startsWith('/login')) target = `${wanted.pathname}${wanted.search}`;
        } catch { /* keep the home route */ }
        window.location.replace(target);
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage(null);
    if (!configured) return setMessage('La connexion sécurisée attend encore la configuration PostgreSQL et AUTH_SECRET.');
    setSubmitting(true);
    try {
      if (mode === 'register') {
        const response = await fetch('/api/auth/register', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, email, password }),
        });
        const payload = await response.json();
        if (!response.ok) {
          const fieldMessage = payload.fields ? Object.values(payload.fields as Record<string, string[]>).flat()[0] : null;
          throw new Error(fieldMessage || payload.error || 'Inscription impossible');
        }
      }
      const callbackUrl = new URLSearchParams(window.location.search).get('callbackUrl') || '/profiles';
      const result = await signIn('credentials', { email, password, redirect: false, callbackUrl });
      if (result?.status === 429) throw new Error('Trop de tentatives. Réessayez dans quelques minutes.');
      if (!result?.ok) throw new Error('Email ou mot de passe incorrect.');
      window.location.assign(result.url || callbackUrl);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Une erreur est survenue.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden bg-[#050608] px-4 py-12 text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(229,9,20,0.18),transparent_35%),radial-gradient(circle_at_85%_80%,rgba(82,16,24,0.2),transparent_30%)]" />
      <section className="relative w-full max-w-md rounded-2xl border border-white/10 bg-[#0d1014]/95 p-6 shadow-[0_30px_100px_rgba(0,0,0,0.65)] backdrop-blur-xl sm:p-8" aria-labelledby="auth-title">
        <div className="text-center">
          <CineverseLogo as="div" className="text-[29px]" />
          <span className="mx-auto mt-5 grid size-12 place-items-center rounded-full border border-primary/25 bg-primary/10 text-primary"><ShieldCheck size={24} /></span>
          <h1 id="auth-title" className="mt-4 text-2xl font-extrabold">{mode === 'login' ? 'Bienvenue' : 'Créer votre compte'}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{mode === 'login' ? 'Connectez-vous pour retrouver vos profils.' : 'Vos listes et préférences seront privées et synchronisées.'}</p>
        </div>

        <div className="mt-7 grid grid-cols-2 rounded-lg border border-white/10 bg-black/30 p-1">
          <button type="button" onClick={() => { setMode('login'); setMessage(null); }} className={`rounded-md px-3 py-2 text-sm font-bold transition-colors ${mode === 'login' ? 'bg-white text-black' : 'text-muted-foreground hover:text-white'}`}>Connexion</button>
          <button type="button" onClick={() => { setMode('register'); setMessage(null); }} className={`rounded-md px-3 py-2 text-sm font-bold transition-colors ${mode === 'register' ? 'bg-white text-black' : 'text-muted-foreground hover:text-white'}`}>Inscription</button>
        </div>

        <form onSubmit={submit} className="mt-6 space-y-4">
          {mode === 'register' && <label className="block"><span className="mb-2 block text-xs font-bold text-[#c8c8cd]">Nom</span><span className="relative block"><UserRound size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" /><input autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} minLength={2} maxLength={60} required className="search-input pl-11" placeholder="Votre nom" /></span></label>}
          <label className="block"><span className="mb-2 block text-xs font-bold text-[#c8c8cd]">Email</span><span className="relative block"><Mail size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" /><input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required className="search-input pl-11" placeholder="vous@exemple.com" /></span></label>
          <label className="block"><span className="mb-2 block text-xs font-bold text-[#c8c8cd]">Mot de passe</span><span className="relative block"><LockKeyhole size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" /><input type={showPassword ? 'text' : 'password'} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={password} onChange={(event) => setPassword(event.target.value)} minLength={mode === 'register' ? 12 : 1} maxLength={128} required className="search-input px-11" placeholder="••••••••••••" /><button type="button" onClick={() => setShowPassword((value) => !value)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-white" aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></span>{mode === 'register' && <span className="mt-2 block text-[11px] leading-relaxed text-muted-foreground">12 caractères minimum avec majuscule, minuscule et chiffre.</span>}</label>

          {configured === false && <div className="rounded-lg border border-amber-400/20 bg-amber-400/[0.07] p-3 text-xs leading-relaxed text-amber-100">Configuration serveur incomplète : ajoutez `DATABASE_URL`, `DIRECT_URL` et `AUTH_SECRET` dans votre environnement local.</div>}
          {message && <div role="alert" className="rounded-lg border border-red-500/25 bg-red-500/10 p-3 text-sm text-red-100">{message}</div>}
          <button type="submit" disabled={submitting || configured !== true} className="w-full rounded-lg bg-primary px-5 py-3 text-sm font-extrabold transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-45">{submitting ? 'Veuillez patienter…' : mode === 'login' ? 'Se connecter' : 'Créer le compte'}</button>
        </form>
      </section>
    </main>
  );
}
