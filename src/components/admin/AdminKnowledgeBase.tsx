'use client';
/* eslint-disable @typescript-eslint/no-explicit-any -- reads the JSON documented and tested in support-admin.integration.test.ts */

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowDown, ArrowUp, Eye, EyeOff, Pencil, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { HELP_CATEGORIES } from '@/lib/help-content';
import { KB_LIMITS } from '@/lib/kb-text';
import { Card, EmptyBlock, ErrorBlock, LoadingBlock, PageHeader, adminFetch, fieldClass, ghostButton, primaryButton, relativeTime, useAdminData } from './ui';

const categoryName = (id: string) => HELP_CATEGORIES.find((category) => category.id === id)?.title ?? id;

export function StateBadge({ state, overridden, origin }: { state: string; overridden: boolean; origin: string }) {
  const tone = state === 'published' ? 'bg-emerald-400/15 text-emerald-200' : state === 'draft' ? 'bg-amber-400/15 text-amber-200' : 'bg-white/10 text-[#b7b7bd]';
  const label = state === 'published' ? 'Publié' : state === 'draft' ? 'Brouillon' : 'Masqué';
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${tone}`} data-state={state}>{label}</span>
      <span className="text-[11px] text-[#8f8f94]">{origin === 'builtin' ? (overridden ? 'Intégré · modifié' : 'Intégré') : 'Créé par l’équipe'}</span>
    </span>
  );
}

type Tab = 'articles' | 'faqs';
const emptyFaq = { question: '', answer: '', category: 'compte', articleSlug: '', status: 'draft' as string, keywords: [] as string[], links: [] as any[] };

export default function AdminKnowledgeBase() {
  const [tab, setTab] = useState<Tab>('articles');
  const articles = useAdminData<any>('/api/admin/support/kb/articles');
  const faqs = useAdminData<any>('/api/admin/support/kb/faqs');
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [filter, setFilter] = useState('');
  const [stateFilter, setStateFilter] = useState('');
  const [confirm, setConfirm] = useState<{ kind: 'article' | 'faq'; id: string; origin: string; label: string } | null>(null);
  const [form, setForm] = useState<{ key: string | null; value: typeof emptyFaq } | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const needle = filter.trim().toLowerCase();
  const shownArticles = useMemo(() => (articles.data?.articles ?? []).filter((article: any) => (!stateFilter || article.state === stateFilter) && (!needle || `${article.title} ${article.slug}`.toLowerCase().includes(needle))), [articles.data, needle, stateFilter]);
  const shownFaqs = useMemo(() => (faqs.data?.faqs ?? []).filter((faq: any) => (!stateFilter || faq.state === stateFilter) && (!needle || faq.question.toLowerCase().includes(needle))), [faqs.data, needle, stateFilter]);
  const unavailable = Boolean(articles.data?.unavailable || faqs.data?.unavailable);

  const run = async (path: string, method: string, json: unknown, success: string, reloads: ('articles' | 'faqs')[]) => {
    setBusy(true); setNotice(null);
    const result = await adminFetch(path, { method, json });
    setBusy(false);
    if (!result.ok) { setNotice({ ok: false, text: result.body.error ?? 'Action impossible.' }); return false; }
    setNotice({ ok: true, text: success });
    await Promise.all(reloads.map((name) => (name === 'articles' ? articles.reload() : faqs.reload())));
    return true;
  };

  const setArticleStatus = (article: any, status: 'draft' | 'published' | 'archived', text: string) => run(`/api/admin/support/kb/articles/${encodeURIComponent(article.slug)}`, 'PATCH', { status }, text, ['articles']);
  const setFaqStatus = (faq: any, status: 'draft' | 'published' | 'archived', text: string) => run(`/api/admin/support/kb/faqs/${encodeURIComponent(faq.key)}`, 'PATCH', { status }, text, ['faqs']);

  const doDelete = async () => {
    if (!confirm) return;
    const base = confirm.kind === 'article' ? 'articles' : 'faqs';
    const ok = await run(`/api/admin/support/kb/${base}/${encodeURIComponent(confirm.id)}`, 'DELETE', undefined, confirm.origin === 'builtin' ? 'Version d’origine restaurée.' : 'Supprimé définitivement.', [confirm.kind === 'article' ? 'articles' : 'faqs']);
    if (ok) setConfirm(null);
  };

  const move = async (index: number, delta: -1 | 1) => {
    const list: any[] = faqs.data?.faqs ?? [];
    const target = index + delta;
    if (target < 0 || target >= list.length) return;
    const keys = list.map((faq) => faq.key);
    [keys[index], keys[target]] = [keys[target], keys[index]];
    await run('/api/admin/support/kb/faqs/order', 'PUT', { keys }, 'Ordre enregistré.', ['faqs']);
  };

  const saveFaq = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form) return;
    setFormError(null);
    const value = { ...form.value, articleSlug: form.value.articleSlug || null };
    const path = form.key ? `/api/admin/support/kb/faqs/${encodeURIComponent(form.key)}` : '/api/admin/support/kb/faqs';
    setBusy(true);
    const result = await adminFetch(path, { method: form.key ? 'PUT' : 'POST', json: value });
    setBusy(false);
    if (!result.ok) return setFormError(result.body.error ?? 'Enregistrement impossible.');
    setForm(null);
    setNotice({ ok: true, text: form.key ? 'Question enregistrée.' : 'Question créée.' });
    await faqs.reload();
  };

  const loading = tab === 'articles' ? articles.loading && !articles.data : faqs.loading && !faqs.data;
  const error = tab === 'articles' ? articles.error : faqs.error;

  return (
    <>
      <PageHeader title="Base de connaissances" description="Articles et questions fréquentes du Centre d’aide. Le contenu intégré est conservé : une modification crée une version qui peut être supprimée pour revenir à l’original."
        actions={tab === 'articles'
          ? <Link href="/admin/support/knowledge-base/articles/new" className={primaryButton} data-testid="new-article"><Plus size={15} aria-hidden="true" />Nouvel article</Link>
          : <button type="button" className={primaryButton} data-testid="new-faq" onClick={() => { setForm({ key: null, value: emptyFaq }); setFormError(null); }}><Plus size={15} aria-hidden="true" />Nouvelle question</button>} />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div role="tablist" aria-label="Contenu" className="flex gap-1">
          {(['articles', 'faqs'] as const).map((value) => (
            <button key={value} type="button" role="tab" aria-selected={tab === value} onClick={() => { setTab(value); setNotice(null); }} data-tab={value} className={`rounded-full px-3.5 py-1.5 text-xs font-bold ${tab === value ? 'bg-primary text-white' : 'text-[#a9a9ae] hover:bg-white/[0.08]'}`}>
              {value === 'articles' ? `Articles${articles.data ? ` (${articles.data.articles.length})` : ''}` : `Questions fréquentes${faqs.data ? ` (${faqs.data.faqs.length})` : ''}`}
            </button>
          ))}
        </div>
        <input type="search" aria-label="Rechercher" placeholder="Rechercher…" value={filter} onChange={(event) => setFilter(event.target.value)} className={`${fieldClass} max-w-xs`} data-testid="kb-search" />
        <select aria-label="État" value={stateFilter} onChange={(event) => setStateFilter(event.target.value)} className={`${fieldClass} max-w-[11rem]`}>
          <option value="">Tous les états</option><option value="published">Publiés</option><option value="draft">Brouillons</option><option value="hidden">Masqués</option>
        </select>
      </div>

      {unavailable && <p role="alert" className="mb-3 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-sm text-amber-100">Les tables de la base de connaissances ne sont pas disponibles : seul le contenu intégré est affiché, en lecture seule. Appliquez la migration de l’administration du support.</p>}
      {notice && <p role={notice.ok ? 'status' : 'alert'} data-testid="kb-notice" className={`mb-3 text-sm ${notice.ok ? 'text-emerald-300' : 'text-red-300'}`}>{notice.text}</p>}

      {confirm && (
        <div role="alertdialog" aria-label="Confirmation" className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-red-400/30 bg-red-500/10 p-3 text-sm" data-testid="kb-confirm">
          <span className="text-red-100">{confirm.origin === 'builtin' ? `Restaurer la version d’origine de « ${confirm.label} » ? Votre version modifiée sera supprimée.` : `Supprimer définitivement « ${confirm.label} » ?`}</span>
          <button type="button" onClick={doDelete} disabled={busy} className="rounded-lg bg-red-600 px-3.5 py-2 font-bold text-white disabled:opacity-50" data-testid="kb-confirm-yes">{confirm.origin === 'builtin' ? 'Restaurer' : 'Supprimer'}</button>
          <button type="button" onClick={() => setConfirm(null)} className={ghostButton}>Annuler</button>
        </div>
      )}

      {error && <ErrorBlock message={error} onRetry={tab === 'articles' ? articles.reload : faqs.reload} />}
      {loading && <LoadingBlock />}

      {tab === 'articles' && articles.data && (shownArticles.length === 0 ? <EmptyBlock>Aucun article ne correspond.</EmptyBlock> : (
        <ul className="space-y-2" data-testid="kb-articles">
          {shownArticles.map((article: any) => (
            <li key={article.slug} data-article={article.slug} data-state={article.state} className="rounded-2xl border border-white/[0.08] bg-[#17191F] p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold">{article.title}</p>
                  <p className="mt-0.5 text-xs text-[#8f8f94]">{categoryName(article.category)} · /help/{article.slug}{article.updatedAt ? ` · modifié ${relativeTime(article.updatedAt)}` : ''}</p>
                  <div className="mt-1.5"><StateBadge state={article.state} overridden={article.overridden} origin={article.origin} /></div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/admin/support/knowledge-base/articles/${encodeURIComponent(article.slug)}`} className={ghostButton}><Pencil size={14} aria-hidden="true" />Modifier</Link>
                  {article.state === 'published'
                    ? <button type="button" disabled={busy} onClick={() => setArticleStatus(article, 'archived', 'Article masqué du Centre d’aide.')} className={ghostButton} data-action="hide"><EyeOff size={14} aria-hidden="true" />Masquer</button>
                    : <button type="button" disabled={busy} onClick={() => setArticleStatus(article, 'published', 'Article publié.')} className={ghostButton} data-action="publish"><Eye size={14} aria-hidden="true" />Publier</button>}
                  {(article.origin === 'custom' || article.overridden) && (
                    <button type="button" disabled={busy} onClick={() => setConfirm({ kind: 'article', id: article.slug, origin: article.origin, label: article.title })} className="inline-flex items-center gap-1.5 px-2 text-sm font-semibold text-red-400 hover:text-red-300" data-action="delete">
                      {article.origin === 'builtin' ? <><RotateCcw size={14} aria-hidden="true" />Restaurer l’original</> : <><Trash2 size={14} aria-hidden="true" />Supprimer</>}
                    </button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      ))}

      {tab === 'faqs' && form && (
        <Card title={form.key ? 'Modifier la question' : 'Nouvelle question'} className="mb-4">
          <form onSubmit={saveFaq} noValidate className="space-y-3" data-testid="faq-form">
            <label className="block text-xs font-semibold text-[#9a9aa3]">Question<input value={form.value.question} maxLength={KB_LIMITS.questionMax} onChange={(event) => setForm({ ...form, value: { ...form.value, question: event.target.value } })} className={`${fieldClass} mt-1`} data-testid="faq-question" /></label>
            <label className="block text-xs font-semibold text-[#9a9aa3]">Réponse (texte simple)<textarea rows={4} value={form.value.answer} maxLength={KB_LIMITS.answerMax} onChange={(event) => setForm({ ...form, value: { ...form.value, answer: event.target.value } })} className={`${fieldClass} mt-1 resize-y`} data-testid="faq-answer" /></label>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="text-xs font-semibold text-[#9a9aa3]">Rubrique<select value={form.value.category} onChange={(event) => setForm({ ...form, value: { ...form.value, category: event.target.value } })} className={`${fieldClass} mt-1`}>{HELP_CATEGORIES.map((category) => <option key={category.id} value={category.id}>{category.title}</option>)}</select></label>
              <label className="text-xs font-semibold text-[#9a9aa3]">Article lié<select value={form.value.articleSlug} onChange={(event) => setForm({ ...form, value: { ...form.value, articleSlug: event.target.value } })} className={`${fieldClass} mt-1`}><option value="">Aucun</option>{(articles.data?.articles ?? []).map((article: any) => <option key={article.slug} value={article.slug}>{article.title}</option>)}</select></label>
              <label className="text-xs font-semibold text-[#9a9aa3]">État<select value={form.value.status} onChange={(event) => setForm({ ...form, value: { ...form.value, status: event.target.value } })} className={`${fieldClass} mt-1`}><option value="draft">Brouillon</option><option value="published">Publié</option><option value="archived">Masqué</option></select></label>
            </div>
            {formError && <p role="alert" className="text-sm text-red-300" data-testid="faq-error">{formError}</p>}
            <div className="flex gap-2"><button type="submit" disabled={busy} className={primaryButton} data-testid="faq-save">Enregistrer</button><button type="button" onClick={() => setForm(null)} className={ghostButton}>Annuler</button></div>
          </form>
        </Card>
      )}

      {tab === 'faqs' && faqs.data && (shownFaqs.length === 0 ? <EmptyBlock>Aucune question ne correspond.</EmptyBlock> : (
        <ul className="space-y-2" data-testid="kb-faqs">
          {shownFaqs.map((faq: any) => {
            const index = (faqs.data.faqs as any[]).findIndex((entry) => entry.key === faq.key);
            const canReorder = !needle && !stateFilter;
            return (
              <li key={faq.key} data-faq={faq.key} data-state={faq.state} className="rounded-2xl border border-white/[0.08] bg-[#17191F] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold">{faq.question}</p>
                    <p className="mt-0.5 text-xs text-[#8f8f94]">{categoryName(faq.category)}{faq.updatedAt ? ` · modifié ${relativeTime(faq.updatedAt)}` : ''}</p>
                    <div className="mt-1.5"><StateBadge state={faq.state} overridden={faq.overridden} origin={faq.origin} /></div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {canReorder && <><button type="button" aria-label={`Monter : ${faq.question}`} disabled={busy || index === 0} onClick={() => move(index, -1)} className={ghostButton} data-action="up"><ArrowUp size={14} aria-hidden="true" /></button><button type="button" aria-label={`Descendre : ${faq.question}`} disabled={busy || index === faqs.data.faqs.length - 1} onClick={() => move(index, 1)} className={ghostButton} data-action="down"><ArrowDown size={14} aria-hidden="true" /></button></>}
                    <button type="button" className={ghostButton} onClick={() => { setForm({ key: faq.key, value: { question: faq.question, answer: faq.answer, category: faq.category, articleSlug: faq.article ?? '', status: faq.state === 'hidden' ? 'archived' : faq.state, keywords: faq.keywords ?? [], links: faq.links ?? [] } }); setFormError(null); }}><Pencil size={14} aria-hidden="true" />Modifier</button>
                    {faq.state === 'published'
                      ? <button type="button" disabled={busy} onClick={() => setFaqStatus(faq, 'archived', 'Question masquée.')} className={ghostButton} data-action="hide"><EyeOff size={14} aria-hidden="true" />Masquer</button>
                      : <button type="button" disabled={busy} onClick={() => setFaqStatus(faq, 'published', 'Question publiée.')} className={ghostButton} data-action="publish"><Eye size={14} aria-hidden="true" />Publier</button>}
                    {(faq.origin === 'custom' || faq.overridden) && (
                      <button type="button" disabled={busy} onClick={() => setConfirm({ kind: 'faq', id: faq.key, origin: faq.origin, label: faq.question })} className="inline-flex items-center gap-1.5 px-2 text-sm font-semibold text-red-400 hover:text-red-300" data-action="delete">
                        {faq.origin === 'builtin' ? <><RotateCcw size={14} aria-hidden="true" />Restaurer</> : <><Trash2 size={14} aria-hidden="true" />Supprimer</>}
                      </button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      ))}
    </>
  );
}
