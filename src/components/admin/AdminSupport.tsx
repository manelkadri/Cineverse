'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ChevronLeft, ChevronRight, Loader2, Mail, Trash2, UserCheck } from 'lucide-react';
import HelpShell from '@/components/help/HelpShell';
import { SUPPORT_CATEGORIES, SUPPORT_LIMITS, SUPPORT_STATUSES } from '@/lib/support-rules';

interface Ticket {
  id: string;
  reference: string;
  email: string;
  subject: string;
  category: string;
  message: string;
  status: string;
  adminNote: string | null;
  accountLinked: boolean;
  createdAt: string;
  updatedAt: string;
}
interface Listing { tickets: Ticket[]; total: number; page: number; pageSize: number; counts: Record<string, number> }

const dateTime = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const label = (list: readonly { id: string; label: string }[], id: string) => list.find((item) => item.id === id)?.label ?? id;
const badge: Record<string, string> = {
  open: 'border-primary/40 bg-primary/10 text-red-200',
  in_progress: 'border-amber-400/30 bg-amber-400/10 text-amber-200',
  resolved: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200',
  closed: 'border-white/15 bg-white/[0.05] text-[#b7b7bd]',
};
const fieldClass = 'w-full rounded-lg border border-white/10 bg-[#0d0f13] px-3 py-2 text-sm text-white focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25';

async function call(path: string, method: string, json?: unknown) {
  try {
    const response = await fetch(path, { method, headers: json === undefined ? undefined : { 'Content-Type': 'application/json' }, body: json === undefined ? undefined : JSON.stringify(json), cache: 'no-store' });
    return { status: response.status, body: await response.json().catch(() => ({})) };
  } catch {
    return { status: 0, body: { error: 'Connexion impossible.' } };
  }
}

export default function AdminSupport() {
  const [status, setStatus] = useState('');
  const [category, setCategory] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Listing | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'denied' | 'unverified' | 'error'>('loading');
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const params = new URLSearchParams({ page: String(page) });
    if (status) params.set('status', status);
    if (category) params.set('category', category);
    const result = await call(`/api/admin/support/tickets?${params}`, 'GET');
    if (result.status === 401) { window.location.assign('/login?callbackUrl=%2Fadmin%2Fsupport'); return; }
    if (result.status === 404) return setState('denied');
    if (result.status === 503 && result.body.code === 'ADMIN_CHECK_FAILED') return setState('unverified');
    if (result.status !== 200) return setState('error');
    setData(result.body as Listing);
    setState('ready');
  }, [category, page, status]);

  useEffect(() => { void load(); }, [load]);

  if (state === 'denied') {
    return (
      <HelpShell>
        <div className="mx-auto max-w-xl px-4 pb-24 pt-40 text-center" data-testid="admin-denied">
          <h1 className="text-3xl font-extrabold">Page introuvable</h1>
          <p className="mt-3 text-sm text-[#a9a9b1]">Cette page n’existe pas ou n’est pas accessible avec ce compte.</p>
          <Link href="/" className="mt-6 inline-flex items-center gap-2 rounded-lg border border-white/15 px-5 py-2.5 text-sm font-semibold text-[#d7d7da] hover:text-white"><ArrowLeft size={16} aria-hidden="true" />Retour à CINEVERSE</Link>
        </div>
      </HelpShell>
    );
  }

  if (state === 'unverified') {
    return (
      <HelpShell>
        <div className="mx-auto max-w-xl px-4 pb-24 pt-40 text-center" data-testid="admin-unverified">
          <h1 className="text-3xl font-extrabold">Vérification impossible</h1>
          <p role="alert" className="mt-3 text-sm text-[#a9a9b1]">Vos droits d’accès n’ont pas pu être vérifiés pour le moment : il s’agit d’une erreur du serveur, pas d’un refus. L’accès reste fermé tant que la vérification échoue.</p>
          <button type="button" onClick={() => { setState('loading'); void load(); }} className="mt-6 rounded-lg bg-primary px-5 py-2.5 text-sm font-bold text-white hover:bg-primary-hover">Réessayer</button>
        </div>
      </HelpShell>
    );
  }

  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const total = data ? Object.values(data.counts).reduce((sum, count) => sum + count, 0) : 0;

  return (
    <HelpShell>
      <div className="mx-auto max-w-5xl px-4 pb-20 pt-28 sm:px-6">
        <h1 className="text-3xl font-extrabold tracking-tight">Demandes d’aide</h1>
        <p className="mt-2 text-sm text-[#9a9aa3]">Réservé à l’équipe de support. Les messages contiennent des données personnelles : ne les copiez pas hors du suivi.</p>

        <div className="mt-6 flex flex-wrap items-center gap-2" role="group" aria-label="Filtrer par statut">
          {[{ id: '', label: 'Toutes' }, ...SUPPORT_STATUSES].map((item) => {
            const count = item.id ? data?.counts[item.id] ?? 0 : total;
            const active = status === item.id;
            return <button key={item.id || 'all'} type="button" aria-pressed={active} onClick={() => { setStatus(item.id); setPage(1); setOpenId(null); }} className={`rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${active ? 'border-primary bg-primary/15 text-white' : 'border-white/12 text-[#b7b7bd] hover:text-white'}`}>{item.label} <span className="tabular-nums text-[#8f8f94]">{count}</span></button>;
          })}
          <label className="ml-auto flex items-center gap-2 text-sm text-[#b7b7bd]">
            <span className="sr-only sm:not-sr-only">Catégorie</span>
            <select value={category} onChange={(event) => { setCategory(event.target.value); setPage(1); setOpenId(null); }} aria-label="Filtrer par catégorie" className={`${fieldClass} w-auto`}>
              <option value="">Toutes</option>
              {SUPPORT_CATEGORIES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
          </label>
        </div>

        <div className="mt-6" aria-live="polite">
          {state === 'loading' && <div className="flex items-center gap-2 text-sm text-[#9a9aa3]"><Loader2 size={16} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />Chargement…</div>}
          {state === 'error' && <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-100">Impossible de charger les demandes. <button type="button" onClick={() => { setState('loading'); void load(); }} className="font-semibold underline">Réessayer</button></p>}
          {state === 'ready' && data && data.tickets.length === 0 && <p data-testid="admin-empty" className="rounded-xl border border-white/[0.08] bg-[#15171C] p-8 text-center text-sm text-[#9a9aa3]">Aucune demande pour ce filtre.</p>}
          {state === 'ready' && data && data.tickets.length > 0 && (
            <ul className="space-y-3" data-testid="admin-tickets">
              {data.tickets.map((ticket) => (
                <TicketCard key={ticket.id} ticket={ticket} open={openId === ticket.id} onToggle={() => setOpenId(openId === ticket.id ? null : ticket.id)} onChanged={load} />
              ))}
            </ul>
          )}
        </div>

        {state === 'ready' && pages > 1 && (
          <nav aria-label="Pagination" className="mt-6 flex items-center justify-center gap-3 text-sm">
            <button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page <= 1} className="inline-flex items-center gap-1 rounded-lg border border-white/15 px-3 py-2 font-semibold disabled:opacity-40"><ChevronLeft size={15} aria-hidden="true" />Précédent</button>
            <span className="tabular-nums text-[#9a9aa3]">Page {page} / {pages}</span>
            <button type="button" onClick={() => setPage((current) => Math.min(pages, current + 1))} disabled={page >= pages} className="inline-flex items-center gap-1 rounded-lg border border-white/15 px-3 py-2 font-semibold disabled:opacity-40">Suivant<ChevronRight size={15} aria-hidden="true" /></button>
          </nav>
        )}
      </div>
    </HelpShell>
  );
}

function TicketCard({ ticket, open, onToggle, onChanged }: { ticket: Ticket; open: boolean; onToggle: () => void; onChanged: () => Promise<void> }) {
  const [note, setNote] = useState(ticket.adminNote ?? '');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const patch = async (body: { status?: string; adminNote?: string }, success: string) => {
    setBusy(true); setNotice(null);
    const result = await call(`/api/admin/support/tickets/${encodeURIComponent(ticket.id)}`, 'PATCH', body);
    setBusy(false);
    if (result.status !== 200) return setNotice({ ok: false, text: result.body.error ?? 'Mise à jour impossible.' });
    setNotice({ ok: true, text: success });
    await onChanged();
  };

  const remove = async () => {
    setBusy(true);
    const result = await call(`/api/admin/support/tickets/${encodeURIComponent(ticket.id)}`, 'DELETE');
    setBusy(false);
    if (result.status !== 200) { setConfirmDelete(false); return setNotice({ ok: false, text: result.body.error ?? 'Suppression impossible.' }); }
    await onChanged();
  };

  return (
    <li data-ticket={ticket.reference} className="rounded-2xl border border-white/[0.08] bg-[#15171C]">
      <h2 className="m-0">
        <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3.5 text-left focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary sm:px-5">
          <span className="font-mono text-xs text-[#8f8f94]">{ticket.reference}</span>
          <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${badge[ticket.status] ?? badge.closed}`}>{label(SUPPORT_STATUSES, ticket.status)}</span>
          <span className="min-w-0 flex-1 basis-full truncate text-[15px] font-bold sm:basis-0">{ticket.subject}</span>
          <span className="text-xs text-[#8f8f94]">{dateTime.format(new Date(ticket.createdAt))}</span>
        </button>
      </h2>
      {open && (
        <div className="space-y-4 border-t border-white/[0.08] px-4 py-4 sm:px-5">
          <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
            <div><dt className="text-xs text-[#8f8f94]">Catégorie</dt><dd>{label(SUPPORT_CATEGORIES, ticket.category)}</dd></div>
            <div><dt className="text-xs text-[#8f8f94]">E-mail</dt><dd className="break-all">{ticket.email}</dd></div>
            <div><dt className="text-xs text-[#8f8f94]">Compte</dt><dd className="flex items-center gap-1.5">{ticket.accountLinked ? <><UserCheck size={14} className="text-emerald-300" aria-hidden="true" />Membre connecté</> : 'Visiteur'}</dd></div>
          </dl>
          <p className="whitespace-pre-wrap break-words rounded-xl border border-white/[0.08] bg-black/25 p-4 text-sm leading-relaxed text-[#d7d7da]" data-testid="ticket-message">{ticket.message}</p>
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-sm">
              <span className="mb-1 block text-xs font-semibold text-[#9a9aa3]">Statut</span>
              <select value={ticket.status} disabled={busy} onChange={(event) => patch({ status: event.target.value }, 'Statut mis à jour.')} className={`${fieldClass} w-auto`} aria-label={`Statut de ${ticket.reference}`}>
                {SUPPORT_STATUSES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
              </select>
            </label>
            <a href={`mailto:${ticket.email}?subject=${encodeURIComponent(`Re: ${ticket.subject} [${ticket.reference}]`)}`} className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-3.5 py-2 text-sm font-semibold text-[#d7d7da] hover:border-white/40 hover:text-white"><Mail size={15} aria-hidden="true" />Répondre par e-mail</a>
          </div>
          <div>
            <label htmlFor={`note-${ticket.id}`} className="mb-1 block text-xs font-semibold text-[#9a9aa3]">Note interne (invisible pour l’auteur)</label>
            <textarea id={`note-${ticket.id}`} rows={3} value={note} maxLength={SUPPORT_LIMITS.noteMax} onChange={(event) => setNote(event.target.value)} className={fieldClass} />
            <button type="button" disabled={busy || note.trim() === (ticket.adminNote ?? '')} onClick={() => patch({ adminNote: note }, 'Note enregistrée.')} className="mt-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-primary-hover disabled:opacity-40">Enregistrer la note</button>
          </div>
          {notice && <p role={notice.ok ? 'status' : 'alert'} className={`text-sm ${notice.ok ? 'text-emerald-300' : 'text-red-300'}`}>{notice.text}</p>}
          <div className="border-t border-white/[0.08] pt-3">
            {confirmDelete ? (
              <div className="flex flex-wrap items-center gap-3 text-sm"><span className="text-red-200">Supprimer définitivement cette demande ?</span><button type="button" onClick={remove} disabled={busy} className="rounded-lg bg-red-600 px-3.5 py-1.5 font-bold text-white disabled:opacity-50">Supprimer</button><button type="button" onClick={() => setConfirmDelete(false)} className="rounded-lg px-3 py-1.5 font-semibold text-[#b7b7bd] hover:bg-white/10">Annuler</button></div>
            ) : (
              <button type="button" onClick={() => setConfirmDelete(true)} className="inline-flex items-center gap-2 text-sm font-semibold text-red-400 hover:text-red-300"><Trash2 size={15} aria-hidden="true" />Supprimer la demande</button>
            )}
          </div>
        </div>
      )}
    </li>
  );
}
