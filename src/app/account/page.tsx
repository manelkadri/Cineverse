'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { signOut } from 'next-auth/react';
import { AlertTriangle, Check, CheckCircle2, Download, Eye, EyeOff, KeyRound, Laptop, LifeBuoy, Loader2, LogOut, Mail, Settings2, ShieldCheck, ShieldAlert, Trash2, UserRound, Users, XCircle } from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import ProfileAvatar from '@/components/ProfileAvatar';

interface AccountSummary {
  /** True only for support staff: shows the link to the ticket review area. */
  supportAdmin?: boolean;
  account: { name: string; email: string; emailVerified: boolean; createdAt: string };
  profiles: { id: string; name: string; avatar: string; isKids: boolean; hasPin: boolean }[];
  sessions: { id: string; current: boolean; expires: string }[];
}

type Result<T = Record<string, unknown>> = { ok: boolean; status: number; body: T & { error?: string; code?: string } };

async function api<T = Record<string, unknown>>(path: string, method: string, json?: unknown): Promise<Result<T>> {
  try {
    const response = await fetch(path, { method, headers: json === undefined ? undefined : { 'Content-Type': 'application/json' }, body: json === undefined ? undefined : JSON.stringify(json), cache: 'no-store' });
    const body = await response.json().catch(() => ({}));
    return { ok: response.ok, status: response.status, body };
  } catch {
    return { ok: false, status: 0, body: { error: 'Connexion impossible. Vérifiez votre réseau et réessayez.', code: 'NETWORK' } as never };
  }
}

const dateFormat = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
const dateTimeFormat = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });

const initials = (name: string, email: string) => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : (parts[0] ?? email).slice(0, 2);
  return letters.toUpperCase();
};

type Notice = { kind: 'success' | 'error'; text: string } | null;

function NoticeLine({ notice }: { notice: Notice }) {
  if (!notice) return null;
  const success = notice.kind === 'success';
  return (
    <p role={success ? 'status' : 'alert'} className={`mt-4 flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm ${success ? 'border-emerald-400/25 bg-emerald-400/10 text-emerald-200' : 'border-red-500/30 bg-red-500/10 text-red-100'}`}>
      {success ? <CheckCircle2 size={17} className="mt-px shrink-0" aria-hidden="true" /> : <XCircle size={17} className="mt-px shrink-0" aria-hidden="true" />}
      <span>{notice.text}</span>
    </p>
  );
}

function Section({ id, icon: Icon, title, description, children, tone = 'default' }: { id: string; icon: React.ComponentType<{ size?: number; className?: string }>; title: string; description?: string; children: React.ReactNode; tone?: 'default' | 'danger' }) {
  return (
    <section aria-labelledby={`${id}-title`} data-section={id} className={`rounded-2xl border bg-[#15171C] p-5 shadow-[0_18px_50px_rgba(0,0,0,0.25)] transition-colors duration-300 motion-reduce:transition-none sm:p-6 ${tone === 'danger' ? 'border-red-500/25 hover:border-red-500/45' : 'border-white/[0.08] hover:border-primary/35'}`}>
      <div className="flex items-start gap-3">
        <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${tone === 'danger' ? 'bg-red-500/10 text-red-400' : 'bg-primary/10 text-primary'}`}><Icon size={20} /></span>
        <div className="min-w-0">
          <h2 id={`${id}-title`} className="text-lg font-bold text-white">{title}</h2>
          {description && <p className="mt-0.5 text-sm text-[#9a9aa3]">{description}</p>}
        </div>
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

const fieldClass = 'w-full rounded-lg border border-white/10 bg-[#0d0f13] px-3.5 py-2.5 text-sm text-white placeholder:text-[#6f6f78] transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25 disabled:cursor-not-allowed disabled:opacity-60';
const primaryButton = 'inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-45';
const ghostButton = 'inline-flex items-center justify-center gap-2 rounded-lg border border-white/15 px-4 py-2.5 text-sm font-semibold text-[#d7d7da] transition-colors hover:border-white/40 hover:text-white disabled:cursor-not-allowed disabled:opacity-45';

function PasswordField({ id, label, value, onChange, autoComplete, describedBy }: { id: string; label: string; value: string; onChange: (value: string) => void; autoComplete: string; describedBy?: string }) {
  const [visible, setVisible] = useState(false);
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-[#d7d7da]">{label}</label>
      <div className="relative">
        <input id={id} type={visible ? 'text' : 'password'} autoComplete={autoComplete} value={value} onChange={(event) => onChange(event.target.value)} aria-describedby={describedBy} className={`${fieldClass} pr-11`} />
        <button type="button" onClick={() => setVisible((current) => !current)} aria-label={visible ? `Masquer ${label.toLowerCase()}` : `Afficher ${label.toLowerCase()}`} aria-pressed={visible} className="absolute right-1.5 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-md text-[#8f8f94] hover:bg-white/10 hover:text-white">
          {visible ? <EyeOff size={17} /> : <Eye size={17} />}
        </button>
      </div>
    </div>
  );
}

const PASSWORD_RULES = [
  { label: '12 caractères minimum', test: (value: string) => value.length >= 12 },
  { label: 'Une minuscule', test: (value: string) => /[a-z]/.test(value) },
  { label: 'Une majuscule', test: (value: string) => /[A-Z]/.test(value) },
  { label: 'Un chiffre', test: (value: string) => /[0-9]/.test(value) },
];

export default function AccountPage() {
  const [data, setData] = useState<AccountSummary | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const result = await api<AccountSummary>('/api/account', 'GET');
    if (result.status === 401) { window.location.assign('/login?callbackUrl=%2Faccount'); return; }
    if (!result.ok) setLoadError(result.body.error ?? 'Impossible de charger votre compte.');
    else { setData(result.body as AccountSummary); setLoadError(null); }
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <main className="min-h-screen bg-[#08090D] text-white">
      <Navbar />
      <div className="mx-auto max-w-6xl px-4 pb-16 pt-24 sm:px-6 lg:px-8">
        <header className="mb-8">
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Mon compte</h1>
          <p className="mt-2 max-w-2xl text-sm text-[#9a9aa3] sm:text-base">Gérez vos informations personnelles, votre sécurité et vos préférences.</p>
        </header>

        {loading && <AccountSkeleton />}
        {!loading && loadError && (
          <div role="alert" className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-center">
            <p className="font-semibold text-red-100">{loadError}</p>
            <button type="button" onClick={() => { setLoading(true); void load(); }} className={`${primaryButton} mt-4`}>Réessayer</button>
          </div>
        )}
        {!loading && data && <AccountContent data={data} reload={load} setData={setData} />}
      </div>
      <Footer />
    </main>
  );
}

function AccountSkeleton() {
  return (
    <div aria-busy="true" aria-label="Chargement du compte" className="space-y-6">
      <div className="h-36 animate-pulse rounded-2xl bg-[#15171C] motion-reduce:animate-none" />
      <div className="grid gap-6 lg:grid-cols-2">
        {[0, 1, 2, 3].map((item) => <div key={item} className="h-64 animate-pulse rounded-2xl bg-[#15171C] motion-reduce:animate-none" />)}
      </div>
    </div>
  );
}

function AccountContent({ data, reload, setData }: { data: AccountSummary; reload: () => Promise<void>; setData: React.Dispatch<React.SetStateAction<AccountSummary | null>> }) {
  const { account, profiles, sessions } = data;
  return (
    <div className="space-y-6">
      <section aria-label="Résumé du compte" data-section="overview" className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-[#15171C] p-5 sm:p-7">
        <div className="pointer-events-none absolute -right-20 -top-24 size-72 rounded-full bg-primary/10 blur-3xl" aria-hidden="true" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center">
          <span aria-hidden="true" className="grid size-20 shrink-0 place-items-center rounded-full border-2 border-primary bg-gradient-to-br from-[#2a0b0e] to-[#15171C] text-2xl font-extrabold tracking-wide shadow-[0_0_28px_rgba(229,9,20,0.3)]">{initials(account.name, account.email)}</span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-2xl font-extrabold" data-testid="account-name">{account.name || 'Compte CINEVERSE'}</p>
            <p className="mt-1 flex items-center gap-2 truncate text-sm text-[#b7b7bd]" data-testid="account-email"><Mail size={15} className="shrink-0 text-primary" aria-hidden="true" />{account.email}</p>
          </div>
          <dl className="grid grid-cols-2 gap-3 sm:text-right">
            <div className="rounded-xl border border-white/[0.08] bg-black/20 px-4 py-3"><dt className="text-[11px] font-semibold uppercase tracking-wider text-[#8f8f94]">Membre depuis</dt><dd className="mt-1 text-sm font-bold" data-testid="account-created">{dateFormat.format(new Date(account.createdAt))}</dd></div>
            <div className="rounded-xl border border-white/[0.08] bg-black/20 px-4 py-3"><dt className="text-[11px] font-semibold uppercase tracking-wider text-[#8f8f94]">Profils</dt><dd className="mt-1 text-sm font-bold" data-testid="account-profile-count">{profiles.length}</dd></div>
          </dl>
        </div>
      </section>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <PersonalInfo account={account} onSaved={(name) => setData((current) => current && { ...current, account: { ...current.account, name } })} />
          <PasswordSection onChanged={reload} />
          <PreferencesSection />
        </div>
        <div className="space-y-6">
          <ProfilesSection profiles={profiles} />
          <SessionsSection sessions={sessions} reload={reload} />
          <PrivacySection />
          {data.supportAdmin && (
            <Section id="support-admin" icon={LifeBuoy} title="Administration du support" description="Réservé à l’équipe de support.">
              <Link href="/admin/support" className={primaryButton}><LifeBuoy size={16} aria-hidden="true" />Ouvrir les demandes d’aide</Link>
            </Section>
          )}
        </div>
      </div>
    </div>
  );
}

function PersonalInfo({ account, onSaved }: { account: AccountSummary['account']; onSaved: (name: string) => void }) {
  const [name, setName] = useState(account.name);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const trimmed = name.trim();
  const unchanged = trimmed === account.name;

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy || unchanged) return;
    if (trimmed.length < 2) return setNotice({ kind: 'error', text: 'Le nom doit contenir au moins 2 caractères.' });
    setBusy(true); setNotice(null);
    const result = await api<{ name: string }>('/api/account', 'PATCH', { name: trimmed });
    setBusy(false);
    if (!result.ok) return setNotice({ kind: 'error', text: result.body.error ?? 'Enregistrement impossible.' });
    setName(result.body.name);
    onSaved(result.body.name);
    setNotice({ kind: 'success', text: 'Votre nom a été mis à jour.' });
  };

  return (
    <Section id="personal" icon={UserRound} title="Informations personnelles" description="Le nom associé à votre compte.">
      <form onSubmit={save} noValidate className="space-y-4">
        <div>
          <label htmlFor="account-name-input" className="mb-1.5 block text-sm font-semibold text-[#d7d7da]">Nom</label>
          <input id="account-name-input" value={name} maxLength={60} autoComplete="name" onChange={(event) => setName(event.target.value)} className={fieldClass} />
        </div>
        <div>
          <label htmlFor="account-email-input" className="mb-1.5 block text-sm font-semibold text-[#d7d7da]">Adresse e-mail</label>
          <input id="account-email-input" value={account.email} readOnly aria-describedby="account-email-help" className={`${fieldClass} cursor-not-allowed text-[#b7b7bd]`} />
          <p id="account-email-help" className="mt-1.5 text-xs text-[#8f8f94]">L’adresse e-mail est votre identifiant de connexion. Elle ne peut pas encore être modifiée : le changement d’adresse nécessitera une confirmation par e-mail, qui n’est pas encore disponible.</p>
        </div>
        <button type="submit" disabled={busy || unchanged} className={primaryButton}>{busy ? <Loader2 size={16} className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <Check size={16} aria-hidden="true" />}{busy ? 'Enregistrement…' : 'Enregistrer'}</button>
      </form>
      <NoticeLine notice={notice} />
    </Section>
  );
}

function PasswordSection({ onChanged }: { onChanged: () => Promise<void> }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const rules = useMemo(() => PASSWORD_RULES.map((rule) => ({ label: rule.label, ok: rule.test(next) })), [next]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    if (!current) return setNotice({ kind: 'error', text: 'Saisissez votre mot de passe actuel.' });
    const failing = rules.find((rule) => !rule.ok);
    if (failing) return setNotice({ kind: 'error', text: `Le nouveau mot de passe est trop faible : ${failing.label.toLowerCase()} requis.` });
    if (next !== confirm) return setNotice({ kind: 'error', text: 'La confirmation ne correspond pas au nouveau mot de passe.' });
    if (next === current) return setNotice({ kind: 'error', text: 'Le nouveau mot de passe doit être différent de l’actuel.' });
    setBusy(true); setNotice(null);
    const result = await api<{ otherSessionsRevoked: number }>('/api/account/password', 'POST', { currentPassword: current, newPassword: next, confirmPassword: confirm });
    setBusy(false);
    if (!result.ok) {
      const text = result.body.code === 'PASSWORD_INCORRECT' ? 'Le mot de passe actuel est incorrect.' : result.body.code === 'RATE_LIMITED' ? 'Trop de tentatives. Réessayez dans quelques minutes.' : result.body.error ?? 'Modification impossible.';
      return setNotice({ kind: 'error', text });
    }
    setCurrent(''); setNext(''); setConfirm('');
    const closed = result.body.otherSessionsRevoked;
    setNotice({ kind: 'success', text: `Mot de passe modifié. ${closed > 0 ? `${closed} autre${closed > 1 ? 's' : ''} session${closed > 1 ? 's ont été fermées' : ' a été fermée'}.` : 'Aucune autre session n’était ouverte.'}` });
    void onChanged();
  };

  return (
    <Section id="security" icon={KeyRound} title="Mot de passe et sécurité" description="Changer le mot de passe ferme vos autres sessions ; celle-ci reste ouverte.">
      <form onSubmit={submit} noValidate className="space-y-4">
        <PasswordField id="current-password" label="Mot de passe actuel" value={current} onChange={setCurrent} autoComplete="current-password" />
        <PasswordField id="new-password" label="Nouveau mot de passe" value={next} onChange={setNext} autoComplete="new-password" describedBy="password-rules" />
        <ul id="password-rules" className="grid grid-cols-1 gap-1.5 text-xs sm:grid-cols-2" aria-label="Exigences du mot de passe">
          {rules.map((rule) => <li key={rule.label} className={`flex items-center gap-1.5 ${rule.ok ? 'text-emerald-300' : 'text-[#8f8f94]'}`}><Check size={13} className={rule.ok ? '' : 'opacity-30'} aria-hidden="true" />{rule.label}</li>)}
        </ul>
        <PasswordField id="confirm-password" label="Confirmer le nouveau mot de passe" value={confirm} onChange={setConfirm} autoComplete="new-password" />
        <button type="submit" disabled={busy} className={primaryButton}>{busy ? <Loader2 size={16} className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <ShieldCheck size={16} aria-hidden="true" />}{busy ? 'Modification…' : 'Modifier le mot de passe'}</button>
      </form>
      <NoticeLine notice={notice} />
    </Section>
  );
}

function PreferencesSection() {
  return (
    <Section id="preferences" icon={Settings2} title="Préférences du compte" description="Réglages qui s’appliquent à l’ensemble du compte.">
      <p className="text-sm leading-relaxed text-[#b7b7bd]">Aucun réglage au niveau du compte n’est disponible pour le moment : l’interface est en français et CINEVERSE n’envoie pas d’e-mails de notification. Les genres préférés et la langue se règlent <strong className="font-semibold text-white">par profil</strong>, depuis la gestion des profils.</p>
      <Link href="/profiles" className={`${ghostButton} mt-4`}>Régler les préférences d’un profil</Link>
    </Section>
  );
}

function ProfilesSection({ profiles }: { profiles: AccountSummary['profiles'] }) {
  return (
    <Section id="profiles" icon={Users} title="Gestion des profils" description="Les profils de ce compte et leur protection par code PIN.">
      {profiles.length === 0 ? <p className="text-sm text-[#9a9aa3]">Aucun profil pour le moment.</p> : (
        <ul className="space-y-2.5" data-testid="account-profiles">
          {profiles.map((profile) => (
            <li key={profile.id} className="flex items-center gap-3 rounded-xl border border-white/[0.08] bg-black/20 p-3">
              <ProfileAvatar avatar={profile.avatar} name={profile.name} className="size-11 shrink-0 rounded-lg" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold">{profile.name}</p>
                {profile.isKids && <p className="text-[11px] text-emerald-400/90">Profil enfant</p>}
              </div>
              {profile.hasPin
                ? <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-300"><ShieldCheck size={12} aria-hidden="true" />PIN actif</span>
                : <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/25 bg-amber-400/10 px-2.5 py-1 text-[11px] font-semibold text-amber-200"><ShieldAlert size={12} aria-hidden="true" />PIN à créer</span>}
            </li>
          ))}
        </ul>
      )}
      <Link href="/profiles" className={`${primaryButton} mt-4`}><Users size={16} aria-hidden="true" />Gérer mes profils</Link>
      <p className="mt-3 text-xs text-[#8f8f94]">Modifier un profil, changer son code PIN ou le supprimer demande toujours votre mot de passe.</p>
    </Section>
  );
}

function SessionsSection({ sessions, reload }: { sessions: AccountSummary['sessions']; reload: () => Promise<void> }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const others = sessions.filter((session) => !session.current);

  const revoke = async (body: Record<string, string>, key: string) => {
    if (busy) return;
    setBusy(key); setNotice(null);
    const result = await api<{ revoked: number; signedOut?: boolean }>('/api/account/sessions', 'DELETE', body);
    if (!result.ok) { setBusy(null); return setNotice({ kind: 'error', text: result.body.error ?? 'Action impossible.' }); }
    if (result.body.signedOut) { await signOut({ callbackUrl: '/login' }); return; }
    await reload();
    setBusy(null);
    setNotice({ kind: 'success', text: key === 'others' ? 'Les autres sessions ont été fermées.' : 'La session a été fermée.' });
  };

  return (
    <Section id="sessions" icon={Laptop} title="Appareils et sessions" description="Les connexions actives de votre compte.">
      <ul className="space-y-2.5" data-testid="account-sessions">
        {sessions.map((session) => (
          <li key={session.id} data-session-current={session.current} className="flex items-center gap-3 rounded-xl border border-white/[0.08] bg-black/20 p-3">
            <Laptop size={20} className={session.current ? 'text-primary' : 'text-[#8f8f94]'} aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold">{session.current ? 'Cette session' : 'Autre session'}</p>
              <p className="text-xs text-[#8f8f94]">Expire le {dateTimeFormat.format(new Date(session.expires))}</p>
            </div>
            {!session.current && <button type="button" onClick={() => revoke({ sessionId: session.id }, session.id)} disabled={busy !== null} className="rounded-lg border border-white/15 px-3 py-1.5 text-xs font-semibold text-[#d7d7da] hover:border-red-400/60 hover:text-white disabled:opacity-45">{busy === session.id ? 'Fermeture…' : 'Fermer'}</button>}
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-[#8f8f94]">CINEVERSE n’enregistre ni le nom de l’appareil, ni le lieu, ni la dernière activité : seule la date d’expiration de chaque connexion est connue.</p>
      <div className="mt-4 flex flex-col gap-2.5 sm:flex-row">
        <button type="button" onClick={() => revoke({ scope: 'others' }, 'others')} disabled={busy !== null || others.length === 0} className={ghostButton}>Fermer les autres sessions</button>
        <button type="button" onClick={() => revoke({ scope: 'all' }, 'all')} disabled={busy !== null} className={ghostButton}><LogOut size={16} aria-hidden="true" />Se déconnecter partout</button>
      </div>
      <NoticeLine notice={notice} />
    </Section>
  );
}

function PrivacySection() {
  const [exportOpen, setExportOpen] = useState(false);
  const [exportPassword, setExportPassword] = useState('');
  const [exporting, setExporting] = useState(false);
  const [exportNotice, setExportNotice] = useState<Notice>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [phrase, setPhrase] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteNotice, setDeleteNotice] = useState<Notice>(null);

  const download = async (event: React.FormEvent) => {
    event.preventDefault();
    if (exporting) return;
    if (!exportPassword) return setExportNotice({ kind: 'error', text: 'Saisissez votre mot de passe pour télécharger vos données.' });
    setExporting(true); setExportNotice(null);
    try {
      const response = await fetch('/api/account/export', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: exportPassword }), cache: 'no-store' });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        setExportNotice({ kind: 'error', text: body.code === 'PASSWORD_INCORRECT' ? 'Mot de passe incorrect.' : body.error ?? 'Téléchargement impossible.' });
      } else {
        const url = URL.createObjectURL(await response.blob());
        const link = document.createElement('a');
        link.href = url; link.download = 'cineverse-mes-donnees.json';
        document.body.appendChild(link); link.click(); link.remove();
        URL.revokeObjectURL(url);
        setExportPassword('');
        setExportNotice({ kind: 'success', text: 'Vos données ont été téléchargées.' });
      }
    } catch {
      setExportNotice({ kind: 'error', text: 'Connexion impossible. Vérifiez votre réseau et réessayez.' });
    }
    setExporting(false);
  };

  const remove = async (event: React.FormEvent) => {
    event.preventDefault();
    if (deleting) return;
    if (!deletePassword) return setDeleteNotice({ kind: 'error', text: 'Saisissez votre mot de passe pour supprimer le compte.' });
    if (phrase !== 'SUPPRIMER') return setDeleteNotice({ kind: 'error', text: 'Saisissez le mot SUPPRIMER pour confirmer.' });
    setDeleting(true); setDeleteNotice(null);
    const result = await api('/api/account', 'DELETE', { password: deletePassword, confirmation: phrase });
    if (!result.ok) {
      setDeleting(false);
      const text = result.body.code === 'PASSWORD_INCORRECT' ? 'Mot de passe incorrect.' : result.body.code === 'RATE_LIMITED' ? 'Trop de tentatives. Réessayez dans quelques minutes.' : result.body.error ?? 'Suppression impossible.';
      return setDeleteNotice({ kind: 'error', text });
    }
    await signOut({ callbackUrl: '/login' });
  };

  return (
    <Section id="privacy" icon={ShieldCheck} title="Confidentialité et données" description="Ce que CINEVERSE conserve et comment le contrôler.">
      <p className="text-sm leading-relaxed text-[#b7b7bd]">CINEVERSE conserve votre nom, votre adresse e-mail, une version chiffrée de votre mot de passe, vos profils (nom, avatar, préférences, codes PIN chiffrés), leurs listes, favoris et historique de visionnage, ainsi que vos sessions de connexion. Rien de tout cela n’est partagé.</p>

      <div className="mt-5 border-t border-white/[0.08] pt-5">
        <h3 className="text-sm font-bold">Télécharger mes données</h3>
        {!exportOpen ? <button type="button" onClick={() => setExportOpen(true)} className={`${ghostButton} mt-3`}><Download size={16} aria-hidden="true" />Télécharger mes données</button> : (
          <form onSubmit={download} noValidate className="mt-3 space-y-3">
            <PasswordField id="export-password" label="Mot de passe du compte" value={exportPassword} onChange={setExportPassword} autoComplete="current-password" />
            <div className="flex gap-2.5">
              <button type="submit" disabled={exporting} className={primaryButton}>{exporting ? <Loader2 size={16} className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <Download size={16} aria-hidden="true" />}Télécharger</button>
              <button type="button" onClick={() => { setExportOpen(false); setExportPassword(''); setExportNotice(null); }} className={ghostButton}>Annuler</button>
            </div>
          </form>
        )}
        <NoticeLine notice={exportNotice} />
      </div>

      <div className="mt-5 rounded-xl border border-red-500/25 bg-red-500/[0.06] p-4">
        <h3 className="flex items-center gap-2 text-sm font-bold text-red-200"><AlertTriangle size={16} aria-hidden="true" />Supprimer mon compte</h3>
        {!deleteOpen ? (
          <>
            <p className="mt-2 text-xs leading-relaxed text-red-100/80">Cette action est définitive : le compte, tous les profils, les listes, favoris, l’historique et les sessions sont supprimés.</p>
            <button type="button" onClick={() => setDeleteOpen(true)} className="mt-3 inline-flex items-center gap-2 rounded-lg border border-red-500/50 px-4 py-2.5 text-sm font-bold text-red-300 transition-colors hover:bg-red-500/15"><Trash2 size={16} aria-hidden="true" />Supprimer mon compte</button>
          </>
        ) : (
          <form onSubmit={remove} noValidate className="mt-3 space-y-3" data-testid="delete-account-form">
            <ul className="list-disc space-y-1 pl-5 text-xs text-red-100/90">
              <li>Tous vos profils et leurs codes PIN seront supprimés.</li>
              <li>Vos listes, favoris et historique de visionnage seront perdus.</li>
              <li>Vous serez déconnecté de tous vos appareils. Aucune récupération n’est possible.</li>
            </ul>
            <PasswordField id="delete-password" label="Mot de passe du compte" value={deletePassword} onChange={setDeletePassword} autoComplete="current-password" />
            <div>
              <label htmlFor="delete-phrase" className="mb-1.5 block text-sm font-semibold text-[#d7d7da]">Tapez <span className="font-extrabold text-red-300">SUPPRIMER</span> pour confirmer</label>
              <input id="delete-phrase" value={phrase} onChange={(event) => setPhrase(event.target.value)} autoComplete="off" autoCapitalize="characters" spellCheck={false} className={fieldClass} />
            </div>
            <div className="flex flex-wrap gap-2.5">
              <button type="submit" disabled={deleting || phrase !== 'SUPPRIMER' || !deletePassword} className="inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-40">{deleting ? <Loader2 size={16} className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <Trash2 size={16} aria-hidden="true" />}Supprimer définitivement</button>
              <button type="button" onClick={() => { setDeleteOpen(false); setDeletePassword(''); setPhrase(''); setDeleteNotice(null); }} className={ghostButton}>Annuler</button>
            </div>
          </form>
        )}
        <NoticeLine notice={deleteNotice} />
      </div>
    </Section>
  );
}
