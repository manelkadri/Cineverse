'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { CheckCircle2, LifeBuoy, Loader2, Mail, Send, XCircle } from 'lucide-react';
import { SENSITIVE_CONTENT_MESSAGE, SUPPORT_CATEGORIES, SUPPORT_LIMITS, containsSensitiveContent, countLinks } from '@/lib/support-rules';

// Optional second channel: a mailbox supplied by the site owner through NEXT_PUBLIC_SUPPORT_EMAIL (read at build time).
// It is never invented: when unset or invalid, only the form is offered.
const configured = (process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? '').trim();
export const SUPPORT_EMAIL = /^[^\s@<>"',;:]+@[^\s@<>"',;:]+\.[^\s@<>"',;:]+$/.test(configured) ? configured : null;

type Fields = 'subject' | 'category' | 'email' | 'message';
type FieldErrors = Partial<Record<Fields, string>>;
type Outcome = { kind: 'success'; reference: string } | { kind: 'error'; text: string } | null;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const inputClass = 'w-full rounded-lg border bg-[#0d0f13] px-3.5 py-2.5 text-sm text-white placeholder:text-[#6f6f78] transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-60';
const borderFor = (error?: string) => (error ? 'border-red-500/60 focus:border-red-400' : 'border-white/10 focus:border-primary');

export default function SupportSection() {
  const { data: session } = useSession();
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [website, setWebsite] = useState(''); // honeypot: real visitors never see or fill it
  const [errors, setErrors] = useState<FieldErrors>({});
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<Outcome>(null);
  const openedAt = useRef(Date.now());
  const emailEdited = useRef(false);
  const submitting = useRef(false);

  // A signed-in member's address is suggested (still editable); it is never sent as an identity, the server reads the session.
  const accountEmail = session?.user?.email ?? '';
  useEffect(() => { if (accountEmail && !emailEdited.current) setEmail(accountEmail); }, [accountEmail]);

  const validate = (): FieldErrors => {
    const next: FieldErrors = {};
    const trimmedSubject = subject.trim();
    const trimmedMessage = message.trim();
    if (trimmedSubject.length < SUPPORT_LIMITS.subjectMin) next.subject = `Le sujet doit contenir au moins ${SUPPORT_LIMITS.subjectMin} caractères.`;
    if (!category) next.category = 'Choisissez une catégorie.';
    if (!EMAIL_PATTERN.test(email.trim())) next.email = 'Saisissez une adresse e-mail valide.';
    if (trimmedMessage.length < SUPPORT_LIMITS.messageMin) next.message = `Décrivez votre demande en au moins ${SUPPORT_LIMITS.messageMin} caractères.`;
    else if (containsSensitiveContent(`${trimmedSubject}\n${trimmedMessage}`)) next.message = SENSITIVE_CONTENT_MESSAGE;
    else if (countLinks(trimmedMessage) > SUPPORT_LIMITS.maxLinks) next.message = 'Votre message contient trop de liens.';
    return next;
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitting.current) return;
    const found = validate();
    setErrors(found);
    setOutcome(null);
    if (Object.keys(found).length > 0) return;
    submitting.current = true;
    setBusy(true);
    try {
      const response = await fetch('/api/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, category, email, message, website, elapsedMs: Date.now() - openedAt.current }),
        cache: 'no-store',
      });
      const body = await response.json().catch(() => ({}));
      if (response.status === 201 && body.stored === true) {
        setOutcome({ kind: 'success', reference: String(body.reference) });
        setSubject(''); setCategory(''); setMessage(''); setErrors({});
        openedAt.current = Date.now();
      } else if (body.fields && typeof body.fields === 'object') {
        const fromServer: FieldErrors = {};
        for (const key of ['subject', 'category', 'email', 'message'] as const) if (body.fields[key]?.[0]) fromServer[key] = body.fields[key][0];
        setErrors(fromServer);
        setOutcome({ kind: 'error', text: body.error ?? 'Votre demande n’a pas été enregistrée.' });
      } else {
        const wait = body.code === 'RATE_LIMITED' && body.retryAfterSeconds ? ` Réessayez dans environ ${Math.max(1, Math.ceil(body.retryAfterSeconds / 60))} minute${body.retryAfterSeconds > 120 ? 's' : ''}.` : '';
        setOutcome({ kind: 'error', text: `${body.error ?? 'Votre demande n’a pas pu être enregistrée.'}${body.code === 'RATE_LIMITED' ? wait : ''}` });
      }
    } catch {
      setOutcome({ kind: 'error', text: 'Connexion impossible : votre demande n’a pas été envoyée. Vérifiez votre réseau et réessayez.' });
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };

  return (
    <section id="contact" aria-labelledby="contact-title" className="scroll-mt-24 rounded-2xl border border-white/[0.08] bg-[#15171C] p-5 sm:p-8">
      <div className="flex items-start gap-4">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><LifeBuoy size={22} aria-hidden="true" /></span>
        <div className="min-w-0 flex-1">
          <h2 id="contact-title" className="text-xl font-extrabold">Vous avez encore besoin d’aide ?</h2>
          <p className="mt-2 text-sm leading-relaxed text-[#b7b7bd]">Décrivez votre problème : votre demande est enregistrée et l’équipe la consulte depuis son espace de suivi. Aucun e-mail de confirmation n’est envoyé automatiquement ; vous recevrez une référence à conserver.</p>
        </div>
      </div>

      {outcome?.kind === 'success' ? (
        <div role="status" data-testid="support-success" className="mt-6 rounded-xl border border-emerald-400/25 bg-emerald-400/10 p-5">
          <p className="flex items-center gap-2 font-bold text-emerald-200"><CheckCircle2 size={18} aria-hidden="true" />Votre demande a été enregistrée.</p>
          <p className="mt-2 text-sm text-emerald-50/90">Référence : <strong data-testid="support-reference" className="font-mono tracking-wide">{outcome.reference}</strong></p>
          <p className="mt-2 text-sm leading-relaxed text-emerald-50/80">Conservez cette référence : aucun e-mail de confirmation n’a été envoyé. L’équipe peut revenir vers vous à l’adresse indiquée.</p>
          <button type="button" onClick={() => setOutcome(null)} className="mt-4 rounded-lg border border-emerald-300/40 px-4 py-2 text-sm font-semibold text-emerald-100 hover:bg-emerald-400/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-300">Envoyer une autre demande</button>
        </div>
      ) : (
        <form onSubmit={submit} noValidate data-testid="support-form" className="mt-6 space-y-4">
          <div>
            <label htmlFor="support-subject" className="mb-1.5 block text-sm font-semibold text-[#d7d7da]">Sujet</label>
            <input id="support-subject" value={subject} maxLength={SUPPORT_LIMITS.subjectMax} onChange={(event) => setSubject(event.target.value)} aria-invalid={Boolean(errors.subject)} aria-describedby={errors.subject ? 'support-subject-error' : undefined} className={`${inputClass} ${borderFor(errors.subject)}`} />
            {errors.subject && <p id="support-subject-error" role="alert" className="mt-1.5 text-xs text-red-300">{errors.subject}</p>}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="support-category" className="mb-1.5 block text-sm font-semibold text-[#d7d7da]">Catégorie</label>
              <select id="support-category" value={category} onChange={(event) => setCategory(event.target.value)} aria-invalid={Boolean(errors.category)} aria-describedby={errors.category ? 'support-category-error' : undefined} className={`${inputClass} ${borderFor(errors.category)}`}>
                <option value="">Choisir…</option>
                {SUPPORT_CATEGORIES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
              </select>
              {errors.category && <p id="support-category-error" role="alert" className="mt-1.5 text-xs text-red-300">{errors.category}</p>}
            </div>
            <div>
              <label htmlFor="support-email-field" className="mb-1.5 block text-sm font-semibold text-[#d7d7da]">Adresse e-mail</label>
              <input id="support-email-field" type="email" inputMode="email" autoComplete="email" value={email} maxLength={254} onChange={(event) => { emailEdited.current = true; setEmail(event.target.value); }} aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? 'support-email-error' : 'support-email-help'} className={`${inputClass} ${borderFor(errors.email)}`} />
              {errors.email ? <p id="support-email-error" role="alert" className="mt-1.5 text-xs text-red-300">{errors.email}</p> : <p id="support-email-help" className="mt-1.5 text-xs text-[#8f8f94]">Pour que l’équipe puisse vous répondre.</p>}
            </div>
          </div>
          <div>
            <label htmlFor="support-message" className="mb-1.5 block text-sm font-semibold text-[#d7d7da]">Message</label>
            <textarea id="support-message" rows={6} value={message} maxLength={SUPPORT_LIMITS.messageMax} onChange={(event) => setMessage(event.target.value)} aria-invalid={Boolean(errors.message)} aria-describedby={errors.message ? 'support-message-error' : 'support-message-help'} className={`${inputClass} resize-y ${borderFor(errors.message)}`} />
            <div className="mt-1.5 flex items-start justify-between gap-3">
              {errors.message ? <p id="support-message-error" role="alert" className="text-xs text-red-300">{errors.message}</p> : <p id="support-message-help" className="text-xs text-[#8f8f94]">Que faisiez-vous, que s’est-il passé, quel message voyez-vous ?</p>}
              <span aria-hidden="true" className="shrink-0 text-xs tabular-nums text-[#6f6f78]">{message.length}/{SUPPORT_LIMITS.messageMax}</span>
            </div>
          </div>
          {/* honeypot */}
          <div aria-hidden="true" className="absolute -left-[9999px] top-auto size-px overflow-hidden">
            <label htmlFor="support-website">Ne pas remplir</label>
            <input id="support-website" name="website" tabIndex={-1} autoComplete="off" value={website} onChange={(event) => setWebsite(event.target.value)} />
          </div>
          <p className="rounded-lg border border-amber-400/20 bg-amber-400/[0.06] px-3 py-2.5 text-xs leading-relaxed text-amber-100/90">N’écrivez jamais votre mot de passe, un code PIN ou un jeton de connexion : le support ne vous les demandera jamais, et un message qui en contient est refusé.</p>
          {outcome?.kind === 'error' && <p role="alert" data-testid="support-error" className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-sm text-red-100"><XCircle size={17} className="mt-px shrink-0" aria-hidden="true" /><span>{outcome.text}</span></p>}
          <button type="submit" disabled={busy} className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
            {busy ? <Loader2 size={16} className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <Send size={16} aria-hidden="true" />}{busy ? 'Envoi…' : 'Envoyer ma demande'}
          </button>
        </form>
      )}

      {SUPPORT_EMAIL && (
        <p className="mt-5 text-sm text-[#b7b7bd]">Vous pouvez aussi écrire directement :{' '}
          <a href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent('Demande d’aide CINEVERSE')}`} data-testid="support-email" className="inline-flex items-center gap-1.5 font-semibold text-white underline decoration-primary underline-offset-4"><Mail size={14} aria-hidden="true" />{SUPPORT_EMAIL}</a>
        </p>
      )}
      <ul className="mt-5 flex flex-wrap gap-2 text-sm">
        <li><Link href="/help/difficultes-de-connexion" className="rounded-full border border-white/12 px-3.5 py-1.5 font-semibold text-[#d7d7da] transition-colors hover:border-primary hover:text-white">Difficultés de connexion</Link></li>
        <li><Link href="/help/signaler-un-probleme" className="rounded-full border border-white/12 px-3.5 py-1.5 font-semibold text-[#d7d7da] transition-colors hover:border-primary hover:text-white">Signaler un problème</Link></li>
      </ul>
    </section>
  );
}
