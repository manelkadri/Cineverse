'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader2, Megaphone, Send, Trash2 } from 'lucide-react';
import { CATEGORY_LABELS, NOTIFICATION_LIMITS } from '@/lib/notification-rules';

interface Announcement { id: string; category: 'catalogue' | 'service'; title: string; message: string; href: string | null; recipientCount: number; readCount: number; createdAt: string }

// Destinations offered in the form. The server accepts any safe internal path, but staff only need these.
const DESTINATIONS = [
  { value: '', label: 'Aucune (notification simple)' },
  { value: '/', label: 'Accueil' },
  { value: '/films-series-catalog', label: 'Catalogue' },
  { value: '/films-series-catalog?type=movie', label: 'Films' },
  { value: '/films-series-catalog?type=tv', label: 'Séries' },
  { value: '/my-list', label: 'Ma liste' },
  { value: '/help', label: 'Centre d’aide' },
  { value: '/account', label: 'Mon compte' },
];

const dateTime = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const fieldClass = 'w-full rounded-lg border border-white/10 bg-[#0d0f13] px-3 py-2 text-sm text-white focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25';

async function call(path: string, method: string, json?: unknown) {
  try {
    const response = await fetch(path, { method, headers: json === undefined ? undefined : { 'Content-Type': 'application/json' }, body: json === undefined ? undefined : JSON.stringify(json), cache: 'no-store' });
    return { status: response.status, body: await response.json().catch(() => ({})) };
  } catch {
    return { status: 0, body: { error: 'Connexion impossible.' } };
  }
}

export default function AdminAnnouncements() {
  const [state, setState] = useState<'loading' | 'ready' | 'denied' | 'unverified' | 'error'>('loading');
  const [items, setItems] = useState<Announcement[]>([]);
  const [category, setCategory] = useState<'catalogue' | 'service'>('catalogue');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [href, setHref] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    const result = await call('/api/admin/announcements', 'GET');
    if (result.status === 401) { window.location.assign('/login?callbackUrl=%2Fadmin%2Fannouncements'); return; }
    if (result.status === 404) return setState('denied');
    if (result.status === 503 && result.body.code === 'ADMIN_CHECK_FAILED') return setState('unverified');
    if (result.status !== 200) return setState('error');
    setItems(result.body.announcements as Announcement[]);
    setState('ready');
  }, []);

  useEffect(() => { void load(); }, [load]);

  const send = async () => {
    setBusy(true); setNotice(null);
    const result = await call('/api/admin/announcements', 'POST', { category, title, message, href });
    setBusy(false); setConfirming(false);
    if (result.status !== 201) return setNotice({ ok: false, text: result.body.error ?? 'Envoi impossible.' });
    const sent = result.body.announcement as Announcement;
    setNotice({ ok: true, text: `Annonce envoyée à ${sent.recipientCount} compte${sent.recipientCount > 1 ? 's' : ''}.` });
    setTitle(''); setMessage(''); setHref('');
    await load();
  };

  const withdraw = async (item: Announcement) => {
    const result = await call(`/api/admin/announcements/${encodeURIComponent(item.id)}`, 'DELETE');
    if (result.status !== 200) return setNotice({ ok: false, text: result.body.error ?? 'Retrait impossible.' });
    setNotice({ ok: true, text: 'Annonce retirée : elle a disparu des notifications de tous les comptes.' });
    await load();
  };

  if (state === 'denied' || state === 'unverified') {
    return (
      <>
        <div className="mx-auto max-w-xl py-16 text-center" data-testid={state === 'denied' ? 'admin-denied' : 'admin-unverified'}>
          <h1 className="text-3xl font-extrabold">{state === 'denied' ? 'Page introuvable' : 'Vérification impossible'}</h1>
          <p className="mt-3 text-sm text-[#a9a9b1]">{state === 'denied' ? 'Cette page n’existe pas ou n’est pas accessible avec ce compte.' : 'Vos droits d’accès n’ont pas pu être vérifiés pour le moment : il s’agit d’une erreur du serveur, pas d’un refus.'}</p>
          <Link href="/" className="mt-6 inline-flex items-center gap-2 rounded-lg border border-white/15 px-5 py-2.5 text-sm font-semibold text-[#d7d7da] hover:text-white"><ArrowLeft size={16} aria-hidden="true" />Retour à CINEVERSE</Link>
        </div>
      </>
    );
  }

  const valid = title.trim().length >= 3 && message.trim().length >= 5;

  return (
    <>
      <div className="max-w-4xl">
        <h1 className="text-xl font-extrabold tracking-tight sm:text-2xl">Annonces</h1>
        <p className="mt-2 text-sm text-[#9a9aa3]">Une annonce est envoyée en notification à tous les comptes qui acceptent sa catégorie. Réservé à l’équipe de support. <Link href="/admin/support/notifications" className="font-semibold text-white underline decoration-primary underline-offset-4">Notifications du support</Link></p>

        {state === 'loading' && <div className="mt-8 flex items-center gap-2 text-sm text-[#9a9aa3]"><Loader2 size={16} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />Chargement…</div>}
        {state === 'error' && <p role="alert" className="mt-8 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-100">Impossible de charger les annonces. <button type="button" onClick={() => { setState('loading'); void load(); }} className="font-semibold underline">Réessayer</button></p>}

        {state === 'ready' && (
          <>
            <form onSubmit={(event) => { event.preventDefault(); if (valid) setConfirming(true); }} noValidate data-testid="announcement-form" className="mt-8 space-y-4 rounded-2xl border border-white/[0.08] bg-[#15171C] p-5 sm:p-6">
              <h2 className="flex items-center gap-2 text-lg font-bold"><Megaphone size={18} className="text-primary" aria-hidden="true" />Nouvelle annonce</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-semibold text-[#d7d7da]">Catégorie
                  <select value={category} onChange={(event) => setCategory(event.target.value as 'catalogue' | 'service')} className={`${fieldClass} mt-1.5`}>
                    <option value="catalogue">{CATEGORY_LABELS.catalogue} : nouveautés du catalogue</option>
                    <option value="service">{CATEGORY_LABELS.service} : actualités du service</option>
                  </select>
                </label>
                <label className="text-sm font-semibold text-[#d7d7da]">Destination au clic
                  <select value={href} onChange={(event) => setHref(event.target.value)} className={`${fieldClass} mt-1.5`}>
                    {DESTINATIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                  </select>
                </label>
              </div>
              <label className="block text-sm font-semibold text-[#d7d7da]">Titre
                <input value={title} maxLength={NOTIFICATION_LIMITS.titleMax} onChange={(event) => setTitle(event.target.value)} className={`${fieldClass} mt-1.5`} />
              </label>
              <label className="block text-sm font-semibold text-[#d7d7da]">Message
                <textarea rows={3} value={message} maxLength={NOTIFICATION_LIMITS.messageMax} onChange={(event) => setMessage(event.target.value)} className={`${fieldClass} mt-1.5 resize-y`} />
                <span className="mt-1 block text-right text-xs tabular-nums text-[#6f6f78]">{message.length}/{NOTIFICATION_LIMITS.messageMax}</span>
              </label>
              {!confirming ? (
                <button type="submit" disabled={!valid} className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-bold text-white hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-40"><Send size={16} aria-hidden="true" />Envoyer…</button>
              ) : (
                <div role="alertdialog" aria-label="Confirmer l’envoi" className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 text-sm">
                  <span className="text-amber-100">Envoyer cette annonce à tous les comptes concernés ? Elle pourra être retirée ensuite.</span>
                  <button type="button" onClick={send} disabled={busy} className="rounded-lg bg-primary px-4 py-2 font-bold text-white hover:bg-primary-hover disabled:opacity-50">{busy ? 'Envoi…' : 'Confirmer l’envoi'}</button>
                  <button type="button" onClick={() => setConfirming(false)} className="rounded-lg px-3 py-2 font-semibold text-[#d7d7da] hover:bg-white/10">Annuler</button>
                </div>
              )}
              {notice && <p role={notice.ok ? 'status' : 'alert'} data-testid="announcement-notice" className={`text-sm ${notice.ok ? 'text-emerald-300' : 'text-red-300'}`}>{notice.text}</p>}
            </form>

            <h2 className="mt-10 text-lg font-bold">Annonces envoyées</h2>
            {items.length === 0 ? <p data-testid="announcement-empty" className="mt-3 rounded-xl border border-white/[0.08] bg-[#15171C] p-6 text-center text-sm text-[#9a9aa3]">Aucune annonce envoyée.</p> : (
              <ul className="mt-4 space-y-3" data-testid="announcement-list">
                {items.map((item) => (
                  <li key={item.id} data-announcement={item.id} className="rounded-2xl border border-white/[0.08] bg-[#15171C] p-4 sm:p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">{CATEGORY_LABELS[item.category]} · {dateTime.format(new Date(item.createdAt))}</p>
                        <p className="mt-1 font-bold">{item.title}</p>
                        <p className="mt-1 whitespace-pre-wrap break-words text-sm text-[#b7b7bd]">{item.message}</p>
                        <p className="mt-2 text-xs text-[#8f8f94]">{item.recipientCount} destinataire{item.recipientCount > 1 ? 's' : ''} · {item.readCount} lue{item.readCount > 1 ? 's' : ''}{item.href ? ` · ${item.href}` : ''}</p>
                      </div>
                      <button type="button" onClick={() => withdraw(item)} className="inline-flex items-center gap-1.5 text-sm font-semibold text-red-400 hover:text-red-300"><Trash2 size={15} aria-hidden="true" />Retirer</button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </>
  );
}
