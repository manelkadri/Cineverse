'use client';
/* eslint-disable @typescript-eslint/no-explicit-any -- reads the JSON documented and tested in support-admin.integration.test.ts */

import React, { useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, LifeBuoy, MessageCircle, Send } from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { SUPPORT_MESSAGE_LIMITS } from '@/lib/support-meta';
import { SENSITIVE_CONTENT_MESSAGE, containsSensitiveContent } from '@/lib/support-rules';
import { EmptyBlock, ErrorBlock, LoadingBlock, StatusBadge, adminFetch, dateTime, fieldClass, primaryButton, relativeTime, useAdminData } from '@/components/admin/ui';

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-[#08090D] text-white">
      <Navbar />
      <div className="mx-auto max-w-3xl px-4 pb-20 pt-28 sm:px-6">{children}</div>
      <Footer />
    </main>
  );
}

const back = 'mb-5 inline-flex items-center gap-2 rounded-lg text-sm font-semibold text-[#a9a9b1] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary';

export function AccountSupportList() {
  const { data, error, loading, reload } = useAdminData<any>('/api/account/support/tickets');
  return (
    <Frame>
      <Link href="/account" className={back}><ArrowLeft size={15} aria-hidden="true" />Mon compte</Link>
      <h1 className="flex items-center gap-3 text-3xl font-extrabold tracking-tight"><LifeBuoy size={26} className="text-primary" aria-hidden="true" />Mes demandes d’aide</h1>
      <p className="mt-2 text-sm text-[#9a9aa3]">Retrouvez ici vos demandes envoyées depuis ce compte et les réponses de l’équipe. <Link href="/help#contact" className="font-semibold text-white underline decoration-primary underline-offset-4">Envoyer une nouvelle demande</Link></p>
      <div className="mt-8">
        {error && <ErrorBlock message={error} onRetry={reload} />}
        {loading && !data && <LoadingBlock />}
        {data && (data.tickets.length === 0
          ? <EmptyBlock testId="account-support-empty">Vous n’avez envoyé aucune demande depuis ce compte. Les demandes envoyées sans être connecté n’apparaissent pas ici.</EmptyBlock>
          : (
            <ul className="space-y-3" data-testid="account-tickets">
              {data.tickets.map((ticket: any) => (
                <li key={ticket.id} data-ticket={ticket.reference}>
                  <Link href={`/account/support/${ticket.id}`} className="block rounded-2xl border border-white/[0.08] bg-[#15171C] p-4 transition-colors hover:border-white/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary motion-reduce:transition-none">
                    <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-mono text-xs text-[#8f8f94]">{ticket.reference}</span><StatusBadge status={ticket.status} /></div>
                    <p className="mt-1.5 font-semibold">{ticket.subject}</p>
                    <p className="mt-1 flex flex-wrap items-center gap-x-3 text-xs text-[#8f8f94]"><span>{ticket.categoryLabel}</span><span>Mise à jour {relativeTime(ticket.updatedAt)}</span>{ticket.answered && <span className="inline-flex items-center gap-1 font-semibold text-emerald-300"><MessageCircle size={12} aria-hidden="true" />Réponse de l’équipe</span>}</p>
                  </Link>
                </li>
              ))}
            </ul>
          ))}
      </div>
    </Frame>
  );
}

export function AccountSupportDetail({ id }: { id: string }) {
  const { data, error, loading, reload } = useAdminData<any>(`/api/account/support/tickets/${encodeURIComponent(id)}`);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const send = async (event: React.FormEvent) => {
    event.preventDefault();
    if (sending) return;
    const text = body.trim();
    if (!text) return setNotice({ ok: false, text: 'Écrivez un message.' });
    if (containsSensitiveContent(text)) return setNotice({ ok: false, text: SENSITIVE_CONTENT_MESSAGE });
    setSending(true); setNotice(null);
    const result = await adminFetch(`/api/account/support/tickets/${encodeURIComponent(id)}/messages`, { method: 'POST', json: { body: text } });
    setSending(false);
    if (!result.ok) return setNotice({ ok: false, text: result.body.error ?? 'Envoi impossible.' });
    setBody('');
    setNotice({ ok: true, text: result.body.reopened ? 'Message envoyé : votre demande est rouverte.' : 'Message envoyé à l’équipe.' });
    await reload();
    endRef.current?.scrollIntoView({ block: 'nearest', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  };

  const ticket = data?.ticket;
  return (
    <Frame>
      <Link href="/account/support" className={back}><ArrowLeft size={15} aria-hidden="true" />Mes demandes d’aide</Link>
      {error && <ErrorBlock message={error} onRetry={reload} />}
      {loading && !data && <LoadingBlock />}
      {ticket && (
        <>
          <p className="font-mono text-xs text-[#8f8f94]" data-testid="ticket-reference">{ticket.reference}</p>
          <div className="mt-1 flex flex-wrap items-start justify-between gap-3"><h1 className="text-2xl font-extrabold tracking-tight" data-testid="ticket-subject">{ticket.subject}</h1><StatusBadge status={ticket.status} /></div>
          <p className="mt-1 text-sm text-[#9a9aa3]">{ticket.categoryLabel} · envoyée le {dateTime.format(new Date(ticket.createdAt))}</p>

          <ol className="mt-6 space-y-3" data-testid="conversation">
            {data.messages.map((message: any) => (
              <li key={message.id} className={`flex ${message.senderType === 'staff' ? 'justify-start' : 'justify-end'}`} data-message-tone={message.senderType}>
                <div className={`max-w-[92%] rounded-2xl border px-4 py-3 sm:max-w-[80%] ${message.senderType === 'staff' ? 'border-primary/30 bg-primary/[0.10]' : 'border-white/[0.08] bg-[#1d2027]'}`}>
                  <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-[#9a9aa3]">{message.senderType === 'staff' ? 'Équipe de support' : 'Vous'} <span className="font-normal normal-case tracking-normal text-[#6f6f78]">· <time dateTime={message.createdAt}>{dateTime.format(new Date(message.createdAt))}</time></span></p>
                  <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-[#e6e6ea]">{message.body}</p>
                </div>
              </li>
            ))}
          </ol>
          <div ref={endRef} />

          <form onSubmit={send} noValidate className="mt-6 rounded-2xl border border-white/[0.08] bg-[#15171C] p-4" data-testid="reply-form">
            <label htmlFor="member-reply" className="text-sm font-semibold">{ticket.status === 'resolved' || ticket.status === 'closed' ? 'Rouvrir cette demande' : 'Ajouter un message'}</label>
            <textarea id="member-reply" rows={4} value={body} maxLength={SUPPORT_MESSAGE_LIMITS.bodyMax} onChange={(event) => setBody(event.target.value)} className={`${fieldClass} mt-2 resize-y`} data-testid="member-reply" />
            <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-[#6f6f78]">N’écrivez jamais de mot de passe, de code PIN ou de jeton. <span className="tabular-nums">{body.length}/{SUPPORT_MESSAGE_LIMITS.bodyMax}</span></p>
              <button type="submit" disabled={sending || !body.trim()} className={primaryButton} data-testid="member-send"><Send size={15} aria-hidden="true" />{sending ? 'Envoi…' : 'Envoyer'}</button>
            </div>
            {notice && <p role={notice.ok ? 'status' : 'alert'} data-testid="member-notice" className={`mt-3 text-sm ${notice.ok ? 'text-emerald-300' : 'text-red-300'}`}>{notice.text}</p>}
          </form>
        </>
      )}
    </Frame>
  );
}
