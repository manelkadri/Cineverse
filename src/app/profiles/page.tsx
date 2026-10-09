'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, KeyRound, LockKeyhole, Pencil, Plus, ShieldCheck, Trash2, X } from 'lucide-react';
import ProfileAvatar, { AVATAR_OPTIONS } from '@/components/ProfileAvatar';
import { useProfiles } from '@/context/ProfileContext';
import type { CineverseProfile, ProfileDraft } from '@/lib/profile-types';
import PinCodeInput from '@/components/PinCodeInput';
import { PinError } from '@/context/ProfileContext';
import { pinProblem } from '@/lib/pin-rules';
import CineverseLogo from '@/components/CineverseLogo';

const GENRES = ['Action', 'Animation', 'Aventure', 'Crime', 'Drame', 'Famille', 'Fantastique', 'Mystère', 'Science-fiction', 'Thriller'];

const EMPTY_DRAFT: ProfileDraft = {
  name: '', avatar: 'ember', isKids: false, maturityLevel: 18, preferences: [], language: 'fr-FR', parentalPin: '', pin: '', confirmPin: '',
};

export default function ProfilesPage() {
  const router = useRouter();
  const { profiles, ready, persistenceMode, error: persistenceError, createProfile, updateProfile, deleteProfile, setProfilePin } = useProfiles();
  const [managing, setManaging] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<CineverseProfile | null>(null);
  const [draft, setDraft] = useState<ProfileDraft>(EMPTY_DRAFT);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  // managing an existing profile is a sensitive action: it asks for the account password again
  const [password, setPassword] = useState('');
  const [changingPin, setChangingPin] = useState(false);

  useEffect(() => {
    document.body.style.overflow = editorOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [editorOpen]);

  const openCreate = () => {
    setEditingProfile(null);
    setDraft({ ...EMPTY_DRAFT, avatar: AVATAR_OPTIONS[profiles.length % AVATAR_OPTIONS.length].id });
    setConfirmDelete(false);
    setPassword(''); setChangingPin(false); setActionError(null);
    setEditorOpen(true);
  };

  const openEdit = (profile: CineverseProfile) => {
    setEditingProfile(profile);
    setDraft({ name: profile.name, avatar: profile.avatar, isKids: profile.isKids, maturityLevel: profile.maturityLevel, preferences: [...profile.preferences], language: profile.language, parentalPin: '', pin: '', confirmPin: '' });
    setConfirmDelete(false);
    setPassword(''); setChangingPin(false); setActionError(null);
    setEditorOpen(true);
  };

  // Choosing a profile never unlocks it: the PIN screen verifies the code on the server first.
  const chooseProfile = (profile: CineverseProfile) => {
    if (managing) return openEdit(profile);
    router.push(`/profiles/${encodeURIComponent(profile.id)}/unlock`);
  };

  const saveProfile = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!draft.name.trim()) return;
    setActionError(null);
    if (!editingProfile || changingPin) {
      const weak = pinProblem(draft.pin ?? '');
      if (weak) return setActionError(weak);
      if (draft.pin !== draft.confirmPin) return setActionError('Les deux codes PIN ne correspondent pas.');
    }
    if (editingProfile && !password) return setActionError('Saisissez le mot de passe du compte pour enregistrer.');
    setSubmitting(true);
    try {
      if (editingProfile) {
        // a locked profile's preferences are not loaded, so they are left untouched instead of being overwritten
        const { pin, confirmPin, ...fields } = draft;
        await updateProfile(editingProfile.id, editingProfile.locked ? { ...fields, preferences: undefined } : fields, password);
        if (changingPin) await setProfilePin(editingProfile.id, pin ?? '', confirmPin ?? '', password);
      } else await createProfile(draft);
      setEditorOpen(false);
    } catch (error) {
      setActionError(error instanceof PinError && error.code === 'PASSWORD_INCORRECT' ? 'Mot de passe incorrect.' : error instanceof Error ? error.message : 'Enregistrement impossible.');
    } finally { setSubmitting(false); setPassword(''); }
  };

  const togglePreference = (genre: string) => {
    setDraft((current) => ({
      ...current,
      preferences: current.preferences.includes(genre)
        ? current.preferences.filter((item) => item !== genre)
        : [...current.preferences, genre],
    }));
  };

  if (!ready) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#050608]">
        <div className="text-center">
          <CineverseLogo as="div" className="text-[36px]" />
          <div className="mx-auto mt-5 size-7 animate-spin rounded-full border-2 border-white/15 border-t-primary" />
        </div>
      </main>
    );
  }

  return (
    <main className="relative flex min-h-screen flex-col overflow-hidden bg-[#050608] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_-10%,rgba(229,9,20,0.13),transparent_38%)]" />
      <header className="relative flex h-20 items-center justify-between px-5 sm:px-8 lg:px-12">
        <button type="button" onClick={() => router.push('/')} className="leading-none" aria-label="Accueil CINEVERSE">
          <CineverseLogo className="text-[29px]" />
        </button>
        <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${persistenceMode === 'database' ? 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300' : 'border-amber-400/20 bg-amber-400/[0.08] text-amber-200'}`}>
          {persistenceMode === 'database' ? 'Synchronisé' : 'Base indisponible'}
        </span>
      </header>

      <section className="relative flex flex-1 items-center justify-center px-5 pb-24 pt-8">
        <div className="w-full max-w-5xl text-center">
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl md:text-5xl">Qui regarde&nbsp;?</h1>
          <p className="mx-auto mt-3 max-w-lg text-sm text-muted-foreground sm:text-base">
            Choisissez votre profil pour retrouver votre sélection et reprendre vos programmes.
          </p>
          {(actionError || persistenceError) && <div role="alert" className="mx-auto mt-5 max-w-lg rounded-lg border border-red-500/25 bg-red-500/10 p-3 text-sm text-red-100">{actionError || persistenceError}</div>}

          <div className="mx-auto mt-10 flex max-w-4xl flex-wrap justify-center gap-x-6 gap-y-8 sm:mt-12 sm:gap-x-8">
            {profiles.map((profile) => (
              <button
                key={profile.id}
                type="button"
                onClick={() => chooseProfile(profile)}
                className="group w-[126px] sm:w-[150px]"
                aria-label={managing ? `Modifier le profil ${profile.name}` : `Continuer avec ${profile.name}`}
              >
                <span className="relative block aspect-square overflow-hidden rounded-2xl border-2 border-transparent shadow-[0_18px_45px_rgba(0,0,0,0.35)] transition-all duration-300 group-hover:-translate-y-1 group-hover:border-white group-hover:shadow-[0_22px_60px_rgba(0,0,0,0.55)]">
                  <ProfileAvatar avatar={profile.avatar} name={profile.name} className="size-full" />
                  {managing && (
                    <span className="absolute inset-0 grid place-items-center bg-black/60 backdrop-blur-[2px]">
                      <span className="grid size-12 place-items-center rounded-full border border-white/30 bg-black/40">
                        <Pencil size={22} />
                      </span>
                    </span>
                  )}
                  <span className="absolute right-2 top-2 grid size-6 place-items-center rounded-full bg-black/65 text-white/85" aria-hidden="true"><LockKeyhole size={13} /></span>
                  {profile.isKids && (
                    <span className="absolute bottom-2 left-2 rounded-md bg-black/65 px-2 py-1 text-[10px] font-extrabold uppercase tracking-wider">Kids</span>
                  )}
                </span>
                <span className="mt-3 block truncate text-base font-semibold text-[#b7b7bd] transition-colors group-hover:text-white sm:text-lg">
                  {profile.name}
                </span>
                {profile.isKids && <span className="mt-0.5 block text-[11px] text-emerald-400/80">Mode protégé</span>}
              </button>
            ))}

            {profiles.length < 5 && (
              <button type="button" onClick={openCreate} className="group w-[126px] sm:w-[150px]" aria-label="Créer un profil">
                <span className="grid aspect-square place-items-center rounded-2xl border-2 border-dashed border-white/20 bg-white/[0.035] text-muted-foreground transition-all duration-300 group-hover:-translate-y-1 group-hover:border-primary group-hover:bg-primary/10 group-hover:text-white">
                  <Plus size={50} strokeWidth={1.35} />
                </span>
                <span className="mt-3 block text-base font-semibold text-[#b7b7bd] transition-colors group-hover:text-white sm:text-lg">Ajouter</span>
              </button>
            )}
          </div>

          {profiles.length === 0 && (
            <div className="mx-auto mt-8 max-w-md rounded-xl border border-white/10 bg-white/[0.03] p-5 text-sm text-muted-foreground">
              Aucun profil pour le moment. Créez votre premier profil pour commencer.
            </div>
          )}

          {profiles.length > 0 && (
            <button
              type="button"
              onClick={() => setManaging((value) => !value)}
              className={`mt-12 inline-flex items-center gap-2 rounded-lg border px-5 py-2.5 text-sm font-bold transition-all ${managing ? 'border-primary bg-primary text-white' : 'border-white/20 text-[#c7c7cb] hover:border-white/50 hover:text-white'}`}
            >
              {managing ? <Check size={17} /> : <Pencil size={17} />}
              {managing ? 'Terminer' : 'Gérer les profils'}
            </button>
          )}
        </div>
      </section>

      {editorOpen && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/80 p-0 backdrop-blur-sm sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-labelledby="profile-editor-title">
          <form onSubmit={saveProfile} className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-t-2xl border border-white/10 bg-[#101318] shadow-2xl sm:rounded-2xl">
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4 sm:px-6">
              <h2 id="profile-editor-title" className="text-xl font-extrabold">{editingProfile ? 'Modifier le profil' : 'Créer un profil'}</h2>
              <button type="button" onClick={() => setEditorOpen(false)} className="grid size-9 place-items-center rounded-full text-muted-foreground hover:bg-white/10 hover:text-white" aria-label="Fermer"><X size={20} /></button>
            </div>

            <div className="space-y-6 p-5 sm:p-6">
              <div>
                <label htmlFor="profile-name" className="mb-2 block text-sm font-semibold">Nom du profil</label>
                <input id="profile-name" autoFocus maxLength={24} value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} placeholder="Ex. Alex" className="search-input" />
              </div>

              {!editingProfile && (
                <div className="rounded-xl border border-white/10 bg-white/[0.035] p-4">
                  <p className="flex items-center gap-2 text-sm font-bold"><KeyRound size={16} className="text-primary" /> Code PIN du profil</p>
                  <p className="mt-1 text-xs text-muted-foreground">4 chiffres, demandés à chaque ouverture du profil.</p>
                  <div className="mt-4 space-y-3">
                    <PinCodeInput id="profile-new-pin" label="Code PIN du profil" value={draft.pin ?? ''} onChange={(pin) => setDraft((current) => ({ ...current, pin }))} />
                    <PinCodeInput id="profile-new-pin-confirm" label="Confirmer le code PIN" value={draft.confirmPin ?? ''} onChange={(confirmPin) => setDraft((current) => ({ ...current, confirmPin }))} />
                  </div>
                </div>
              )}

              <fieldset>
                <legend className="mb-3 text-sm font-semibold">Avatar</legend>
                <div className="flex flex-wrap gap-3">
                  {AVATAR_OPTIONS.map((option) => (
                    <button key={option.id} type="button" onClick={() => setDraft((current) => ({ ...current, avatar: option.id }))} className={`relative size-16 overflow-hidden rounded-xl border-2 transition-all ${draft.avatar === option.id ? 'border-primary ring-4 ring-primary/15' : 'border-transparent hover:border-white/60'}`} aria-label={`Avatar ${option.label}`}>
                      <ProfileAvatar avatar={option.id} name={option.label} className="size-full" />
                      {draft.avatar === option.id && <span className="absolute right-1 top-1 grid size-5 place-items-center rounded-full bg-primary"><Check size={12} strokeWidth={3} /></span>}
                    </button>
                  ))}
                </div>
              </fieldset>

              <div className="rounded-xl border border-white/10 bg-white/[0.035] p-4">
                <label className="flex cursor-pointer items-start gap-3">
                  <input type="checkbox" checked={draft.isKids} onChange={(event) => setDraft((current) => ({ ...current, isKids: event.target.checked, maturityLevel: event.target.checked ? 10 : 18, avatar: event.target.checked ? 'mint' : current.avatar }))} className="mt-1 rounded border-white/20 bg-black text-primary focus:ring-primary" />
                  <span>
                    <span className="flex items-center gap-2 text-sm font-bold"><ShieldCheck size={17} className="text-emerald-400" /> Profil enfant</span>
                    <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">Masque automatiquement les contenus dépassant la classification autorisée.</span>
                  </span>
                </label>
                {draft.isKids && (
                  <div className="mt-4 grid gap-4 border-t border-white/10 pt-4 sm:grid-cols-2">
                    <label className="text-xs font-semibold text-[#c8c8cc]">Classification maximale
                      <select value={draft.maturityLevel} onChange={(event) => setDraft((current) => ({ ...current, maturityLevel: Number(event.target.value) }))} className="filter-select mt-2 w-full">
                        <option value={7}>7+</option><option value={10}>10+</option>
                      </select>
                    </label>
                    <label className="text-xs font-semibold text-[#c8c8cc]">Code parental
                      <div className="relative mt-2"><LockKeyhole size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><input inputMode="numeric" maxLength={4} required value={draft.parentalPin} onChange={(event) => setDraft((current) => ({ ...current, parentalPin: event.target.value.replace(/\D/g, '') }))} placeholder={editingProfile ? 'Code actuel' : '4 chiffres'} className="search-input py-2.5 pl-9" /></div>
                    </label>
                  </div>
                )}
              </div>

              {editingProfile?.locked ? (
                <p className="rounded-lg border border-white/10 bg-white/[0.03] p-3 text-xs text-muted-foreground">Les préférences sont modifiables une fois le profil ouvert avec son code PIN.</p>
              ) : (
              <fieldset>
                <legend className="mb-3 text-sm font-semibold">Préférences</legend>
                <div className="flex flex-wrap gap-2">
                  {GENRES.map((genre) => {
                    const selected = draft.preferences.includes(genre);
                    return <button key={genre} type="button" onClick={() => togglePreference(genre)} className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${selected ? 'border-primary bg-primary/15 text-white' : 'border-white/10 bg-white/[0.03] text-muted-foreground hover:text-white'}`}>{genre}</button>;
                  })}
                </div>
              </fieldset>
              )}

              {editingProfile && (
                <div className="space-y-4 rounded-xl border border-white/10 bg-white/[0.035] p-4">
                  <div>
                    <label htmlFor="profile-account-password" className="mb-2 block text-sm font-semibold">Mot de passe du compte</label>
                    <input id="profile-account-password" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Requis pour enregistrer ou supprimer" className="search-input" />
                  </div>
                  <div>
                    <button type="button" onClick={() => { setChangingPin((value) => !value); setDraft((current) => ({ ...current, pin: '', confirmPin: '' })); }} className="inline-flex items-center gap-2 text-sm font-semibold text-white/85 hover:text-white"><KeyRound size={16} className="text-primary" /> {changingPin ? 'Garder le code PIN actuel' : editingProfile.hasPin ? 'Changer le code PIN' : 'Définir un code PIN'}</button>
                    {changingPin && (
                      <div className="mt-4 space-y-3">
                        <PinCodeInput id="profile-change-pin" label="Nouveau code PIN" value={draft.pin ?? ''} onChange={(pin) => setDraft((current) => ({ ...current, pin }))} />
                        <PinCodeInput id="profile-change-pin-confirm" label="Confirmer le nouveau code PIN" value={draft.confirmPin ?? ''} onChange={(confirmPin) => setDraft((current) => ({ ...current, confirmPin }))} />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {editingProfile && (
                <div className="border-t border-white/10 pt-5">
                  {confirmDelete ? (
                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-500/25 bg-red-500/10 p-3">
                      <p className="text-xs text-red-100">Supprimer ce profil et toutes ses données&nbsp;?</p>
                      <div className="flex gap-2"><button type="button" onClick={() => setConfirmDelete(false)} className="rounded-md px-3 py-1.5 text-xs font-bold text-white/70 hover:bg-white/10">Annuler</button><button type="button" disabled={submitting} onClick={async () => { setSubmitting(true); setActionError(null); try { if (!password) throw new Error('Saisissez le mot de passe du compte pour supprimer ce profil.'); await deleteProfile(editingProfile.id, password, draft.parentalPin); setEditorOpen(false); } catch (error) { setActionError(error instanceof Error ? error.message : 'Suppression impossible.'); setConfirmDelete(false); } finally { setSubmitting(false); } }} className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-bold disabled:opacity-50">Supprimer</button></div>
                    </div>
                  ) : (
                    <button type="button" onClick={() => setConfirmDelete(true)} className="inline-flex items-center gap-2 text-sm font-semibold text-red-400 hover:text-red-300"><Trash2 size={16} /> Supprimer le profil</button>
                  )}
                </div>
              )}
              {actionError && <div role="alert" className="rounded-lg border border-red-500/25 bg-red-500/10 p-3 text-sm text-red-100">{actionError}</div>}
            </div>

            <div className="flex justify-end gap-3 border-t border-white/10 px-5 py-4 sm:px-6">
              <button type="button" onClick={() => setEditorOpen(false)} className="rounded-lg px-4 py-2 text-sm font-bold text-muted-foreground hover:bg-white/5 hover:text-white">Annuler</button>
              <button type="submit" disabled={!draft.name.trim() || submitting} className="rounded-lg bg-primary px-5 py-2 text-sm font-bold text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-40">{submitting ? 'Enregistrement…' : 'Enregistrer'}</button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}
