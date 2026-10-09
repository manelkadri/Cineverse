'use client';
/* eslint-disable @typescript-eslint/no-explicit-any -- the detail view reads the JSON documented and tested in support-admin.integration.test.ts */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, CheckCheck, EyeOff, Lock, Mail, Send, Trash2, UserRound } from 'lucide-react';
import { AUDIT_LABELS, SUPPORT_MESSAGE_LIMITS, SUPPORT_PRIORITIES, type AuditAction } from '@/lib/support-meta';
import { SENSITIVE_CONTENT_MESSAGE, SUPPORT_STATUSES, containsSensitiveContent } from '@/lib/support-rules';
import { Card, ErrorBlock, LoadingBlock, PriorityBadge, StatusBadge, adminFetch, dateTime, fieldClass, ghostButton, primaryButton, relativeTime, statusLabel, useAdminData } from './ui';

function Bubble({ side, label, time, tone, children, footer }: { side: 'left' | 'right'; label: string; time: string; tone: 'user' | 'staff' | 'internal'; children: React.ReactNode; footer?: React.ReactNode }) {
  const style = tone === 'internal' ? 'border border-dashed border-amber-400/40 bg-amber-400/[0.06]' : tone === 'staff' ? 'border border-primary/30 bg-primary/[0.10]' : 'border border-white/[0.08] bg-[#1d2027]';
  return (
    <li className={`flex ${side === 'right' ? 'justify-end' : 'justify-start'}`} data-message-tone={tone}>
      <div className={`max-w-[92%] rounded-2xl px-4 py-3 sm:max-w-[80%] ${style}`}>
        <p className="mb-1 flex flex-wrap items-center gap-x-2 text-[11px] font-semibold uppercase tracking-wider text-[#9a9aa3]">
          {tone === 'internal' && <EyeOff size={12} aria-hidden="true" className="text-amber-300" />}{label}<span className="font-normal normal-case tracking-normal text-[#6f6f78]">· <time dateTime={time} title={dateTime.format(new Date(time))}>{relativeTime(time)}</time></span>
        </p>
        <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-[#e6e6ea]">{children}</p>
        {footer && <p className="mt-2 text-[11px] text-[#8f8f94]">{footer}</p>}
      </div>
    </li>
  );
}

export default function AdminTicketDetail({ id }: { id: string }) {
  const router = useRouter();
  const { data, error, loading, reload } = useAdminData<any>(`/api/admin/support/tickets/${encodeURIComponent(id)}`);
  const staff = useAdminData<any>('/api/admin/support/staff');
  const categories = useAdminData<any>('/api/admin/support/categories');
  const [visibility, setVisibility] = useState<'public' | 'internal'>('public');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const canReplyPublicly = Boolean(data?.canReplyPublicly);
  useEffect(() => { if (data && !canReplyPublicly) setVisibility('internal'); }, [data, canReplyPublicly]);
  const categoryLabel = useMemo(() => (categories.data?.categories ?? []).find((category: any) => category.id === data?.ticket.category)?.label ?? data?.ticket.category, [categories.data, data]);

  if (loading && !data) return <LoadingBlock />;
  if (error || !data) return <><Link href="/admin/support/tickets" className={`${ghostButton} mb-4`}><ArrowLeft size={15} aria-hidden="true" />Retour aux demandes</Link><ErrorBlock message={error ?? 'Ticket introuvable.'} onRetry={reload} /></>;
  const ticket = data.ticket;

  const change = async (json: object, success: string) => {
    setSaving(true); setNotice(null);
    const result = await adminFetch(`/api/admin/support/tickets/${encodeURIComponent(id)}`, { method: 'PATCH', json });
    setSaving(false);
    if (!result.ok) return setNotice({ ok: false, text: result.body.error ?? 'Modification impossible.' });
    setNotice({ ok: true, text: success });
    await reload();
  };

  const send = async (event: React.FormEvent) => {
    event.preventDefault();
    if (sending) return;
    const text = body.trim();
    if (!text) return setNotice({ ok: false, text: 'Écrivez un message.' });
    if (containsSensitiveContent(text)) return setNotice({ ok: false, text: SENSITIVE_CONTENT_MESSAGE });
    setSending(true); setNotice(null);
    const result = await adminFetch(`/api/admin/support/tickets/${encodeURIComponent(id)}/messages`, { method: 'POST', json: { body: text, visibility } });
    setSending(false);
    if (!result.ok) return setNotice({ ok: false, text: result.body.error ?? 'Envoi impossible.' });
    setBody('');
    setNotice({ ok: true, text: visibility === 'public' ? 'Réponse publiée dans le compte de l’auteur.' : 'Note interne ajoutée.' });
    await reload();
    endRef.current?.scrollIntoView({ block: 'nearest', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  };

  const remove = async () => {
    setSaving(true);
    const result = await adminFetch(`/api/admin/support/tickets/${encodeURIComponent(id)}`, { method: 'DELETE' });
    setSaving(false);
    if (!result.ok) { setConfirmDelete(false); return setNotice({ ok: false, text: result.body.error ?? 'Suppression impossible.' }); }
    router.replace('/admin/support/tickets');
  };

  return (
    <>
      <Link href="/admin/support/tickets" className={`${ghostButton} mb-4`}><ArrowLeft size={15} aria-hidden="true" />Retour aux demandes</Link>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-xs text-[#8f8f94]" data-testid="ticket-reference">{ticket.reference}</p>
          <h1 className="mt-1 text-xl font-extrabold tracking-tight sm:text-2xl" data-testid="ticket-subject">{ticket.subject}</h1>
          <p className="mt-1 text-sm text-[#9a9aa3]">{categoryLabel} · ouverte le {dateTime.format(new Date(ticket.createdAt))} · mise à jour {relativeTime(ticket.updatedAt)}</p>
        </div>
        <div className="flex items-center gap-3"><StatusBadge status={ticket.status} /><PriorityBadge priority={ticket.priority} /></div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-4">
          <Card title="Conversation">
            <ol className="space-y-3" data-testid="conversation">
              <Bubble side="left" tone="user" label={ticket.accountLinked ? 'Auteur (membre connecté)' : 'Auteur (visiteur)'} time={ticket.createdAt}>{ticket.message}</Bubble>
              {ticket.adminNote && <Bubble side="right" tone="internal" label="Note interne (ancienne)" time={ticket.createdAt}>{ticket.adminNote}</Bubble>}
              {data.messages.map((message: any) => message.senderType === 'user'
                ? <Bubble key={message.id} side="left" tone="user" label="Auteur" time={message.createdAt}>{message.body}</Bubble>
                : message.visibility === 'internal'
                  ? <Bubble key={message.id} side="right" tone="internal" label={`Note interne — ${message.authorName}`} time={message.createdAt} footer={<><Lock size={11} className="mr-1 inline" aria-hidden="true" />Privée : jamais visible par l’auteur</>}>{message.body}</Bubble>
                  : <Bubble key={message.id} side="right" tone="staff" label={`Support — ${message.authorName}`} time={message.createdAt} footer={<><CheckCheck size={12} className="mr-1 inline text-emerald-400" aria-hidden="true" />Publié dans le compte de l’auteur</>}>{message.body}</Bubble>)}
            </ol>
            <div ref={endRef} />
          </Card>

          <Card title="Répondre">
            <div role="tablist" aria-label="Type de message" className="mb-3 flex gap-1">
              <button type="button" role="tab" aria-selected={visibility === 'public'} disabled={!canReplyPublicly} onClick={() => setVisibility('public')} data-visibility="public" className={`rounded-full px-3.5 py-1.5 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-40 ${visibility === 'public' ? 'bg-primary text-white' : 'text-[#a9a9ae] hover:bg-white/[0.08]'}`}>Réponse à l’auteur</button>
              <button type="button" role="tab" aria-selected={visibility === 'internal'} onClick={() => setVisibility('internal')} data-visibility="internal" className={`rounded-full px-3.5 py-1.5 text-xs font-bold ${visibility === 'internal' ? 'bg-amber-400/20 text-amber-100' : 'text-[#a9a9ae] hover:bg-white/[0.08]'}`}>Note interne</button>
            </div>
            {!canReplyPublicly && <p data-testid="no-delivery" className="mb-3 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2.5 text-xs leading-relaxed text-[#b7b7bd]">Cette demande a été envoyée sans compte : aucune réponse ne peut être livrée à son auteur depuis CINEVERSE, et aucun e-mail n’est envoyé automatiquement. Vous pouvez ajouter une note interne{' '}ou répondre depuis votre messagerie.{' '}<a href={`mailto:${ticket.email}?subject=${encodeURIComponent(`Re: ${ticket.subject} [${ticket.reference}]`)}`} className="inline-flex items-center gap-1 font-semibold text-white underline decoration-primary underline-offset-4"><Mail size={12} aria-hidden="true" />Répondre par e-mail</a></p>}
            <form onSubmit={send} noValidate>
              <label htmlFor="reply-body" className="sr-only">{visibility === 'public' ? 'Votre réponse à l’auteur' : 'Votre note interne'}</label>
              <textarea id="reply-body" rows={5} value={body} maxLength={SUPPORT_MESSAGE_LIMITS.bodyMax} onChange={(event) => setBody(event.target.value)} placeholder={visibility === 'public' ? 'Votre réponse (lue par l’auteur dans son compte)…' : 'Votre note (privée, réservée à l’équipe)…'} className={`${fieldClass} resize-y`} />
              <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-[#6f6f78]">{visibility === 'public' ? 'N’écrivez jamais de mot de passe, de code PIN ou de jeton.' : 'Visible uniquement par l’équipe de support.'} <span className="tabular-nums">{body.length}/{SUPPORT_MESSAGE_LIMITS.bodyMax}</span></p>
                <button type="submit" disabled={sending || body.trim().length === 0} className={primaryButton} data-testid="send-message"><Send size={15} aria-hidden="true" />{sending ? 'Envoi…' : visibility === 'public' ? 'Envoyer la réponse' : 'Ajouter la note'}</button>
              </div>
            </form>
            {notice && <p role={notice.ok ? 'status' : 'alert'} data-testid="ticket-notice" className={`mt-3 text-sm ${notice.ok ? 'text-emerald-300' : 'text-red-300'}`}>{notice.text}</p>}
          </Card>
        </div>

        <div className="space-y-4">
          <Card title="Traitement">
            <div className="space-y-3">
              <label className="block text-xs font-semibold text-[#9a9aa3]">Statut
                <select aria-label="Statut" value={ticket.status} disabled={saving} onChange={(event) => change({ status: event.target.value }, `Statut : ${statusLabel(event.target.value)}.`)} className={`${fieldClass} mt-1`}>{SUPPORT_STATUSES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select>
              </label>
              <label className="block text-xs font-semibold text-[#9a9aa3]">Priorité
                <select aria-label="Priorité" value={ticket.priority} disabled={saving} onChange={(event) => change({ priority: event.target.value }, 'Priorité mise à jour.')} className={`${fieldClass} mt-1`}>{SUPPORT_PRIORITIES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select>
              </label>
              <label className="block text-xs font-semibold text-[#9a9aa3]">Assignée à
                <select aria-label="Assignée à" value={ticket.assignedTo?.id ?? ''} disabled={saving} onChange={(event) => change({ assignedToId: event.target.value || null }, event.target.value ? 'Assignation enregistrée.' : 'Assignation retirée.')} className={`${fieldClass} mt-1`}>
                  <option value="">Non assignée</option>{(staff.data?.staff ?? []).map((member: any) => <option key={member.id} value={member.id}>{member.name}{member.you ? ' (moi)' : ''}</option>)}
                </select>
              </label>
            </div>
          </Card>

          <Card title="Expéditeur">
            <dl className="space-y-2 text-sm">
              <div><dt className="text-xs text-[#8f8f94]">Adresse e-mail</dt><dd className="break-all">{ticket.email}</dd></div>
              <div><dt className="text-xs text-[#8f8f94]">Compte</dt><dd className="flex items-center gap-1.5"><UserRound size={14} className={ticket.accountLinked ? 'text-emerald-300' : 'text-[#6f6f78]'} aria-hidden="true" />{ticket.accountLinked ? 'Membre connecté : peut lire vos réponses dans son compte' : 'Visiteur : aucune réponse livrable'}</dd></div>
              <div><dt className="text-xs text-[#8f8f94]">Première réponse</dt><dd>{ticket.firstResponseAt ? dateTime.format(new Date(ticket.firstResponseAt)) : 'Aucune pour le moment'}</dd></div>
              <div><dt className="text-xs text-[#8f8f94]">État</dt><dd>{ticket.awaitingStaff && ['open', 'in_progress'].includes(ticket.status) ? 'En attente de l’équipe' : 'Pris en charge'}</dd></div>
            </dl>
          </Card>

          <Card title="Historique">
            {data.history.length === 0 ? <p className="text-sm text-[#8f8f94]">Aucune action enregistrée.</p> : (
              <ul className="space-y-2.5 text-sm" data-testid="ticket-history">
                {data.history.map((entry: any) => (
                  <li key={entry.id}><p className="font-semibold">{AUDIT_LABELS[entry.action as AuditAction] ?? entry.action}</p><p className="text-xs text-[#8f8f94]">{entry.actorName} · {relativeTime(entry.createdAt)}</p></li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Zone sensible">
            {confirmDelete ? (
              <div className="space-y-2 text-sm"><p className="text-red-200">Supprimer définitivement cette demande et sa conversation ? Seule sa référence restera dans le journal d’audit.</p><div className="flex gap-2"><button type="button" onClick={remove} disabled={saving} className="rounded-lg bg-red-600 px-3.5 py-2 text-sm font-bold text-white disabled:opacity-50">Supprimer</button><button type="button" onClick={() => setConfirmDelete(false)} className={ghostButton}>Annuler</button></div></div>
            ) : <button type="button" onClick={() => setConfirmDelete(true)} className="inline-flex items-center gap-2 text-sm font-semibold text-red-400 hover:text-red-300"><Trash2 size={15} aria-hidden="true" />Supprimer la demande</button>}
          </Card>
        </div>
      </div>
    </>
  );
}
