'use client';
/* eslint-disable @typescript-eslint/no-explicit-any -- reads the JSON documented and tested in support-admin.integration.test.ts */

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Save } from 'lucide-react';
import { HELP_CATEGORIES } from '@/lib/help-content';
import { KB_LIMITS, blocksProblem, parseArticleText } from '@/lib/kb-text';
import { ArticleBody, LinkChips } from '@/components/help/HelpParts';
import { Card, ErrorBlock, LoadingBlock, adminFetch, fieldClass, ghostButton, primaryButton, useAdminData } from './ui';
import { StateBadge } from './AdminKnowledgeBase';

const SYNTAX = '## Titre de section\nUn paragraphe.\n\n1. Une étape\n2. Une autre étape\n\n- Une puce\n\n> Note : une information\n> Attention : un avertissement';

export default function AdminArticleEditor({ slug }: { slug: string | null }) {
  const router = useRouter();
  const existing = useAdminData<any>(slug ? `/api/admin/support/kb/articles/${encodeURIComponent(slug)}` : null);
  const [loaded, setLoaded] = useState(!slug);
  const [title, setTitle] = useState('');
  const [address, setAddress] = useState('');
  const [category, setCategory] = useState('compte');
  const [summary, setSummary] = useState('');
  const [content, setContent] = useState('');
  const [keywords, setKeywords] = useState('');
  const [links, setLinks] = useState('');
  const [status, setStatus] = useState('draft');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  useEffect(() => {
    const article = existing.data?.article;
    if (!article || loaded) return;
    setTitle(article.title); setCategory(article.category); setSummary(article.summary); setContent(article.content);
    setKeywords((article.keywords ?? []).join(', '));
    setLinks((article.links ?? []).map((link: any) => `${link.label} | ${link.href}`).join('\n'));
    setStatus(article.state === 'hidden' ? 'archived' : article.state);
    setLoaded(true);
  }, [existing.data, loaded]);

  const blocks = useMemo(() => parseArticleText(content), [content]);
  const problem = useMemo(() => blocksProblem(blocks), [blocks]);
  const parsedLinks = useMemo(() => links.split('\n').map((line) => line.trim()).filter(Boolean).map((line) => { const [label, ...rest] = line.split('|'); return { label: label.trim(), href: rest.join('|').trim() }; }), [links]);

  if (slug && existing.loading && !existing.data) return <LoadingBlock />;
  if (slug && (existing.error || !existing.data)) return <><Link href="/admin/support/knowledge-base" className={`${ghostButton} mb-4`}><ArrowLeft size={15} aria-hidden="true" />Retour</Link><ErrorBlock message={existing.error ?? 'Article introuvable.'} onRetry={existing.reload} /></>;
  const article = existing.data?.article;

  const save = async (event: React.FormEvent, nextStatus?: string) => {
    event.preventDefault();
    setNotice(null); setFieldErrors({});
    if (problem) return setNotice({ ok: false, text: problem });
    const payload = {
      title, category, summary, content, status: nextStatus ?? status,
      keywords: keywords.split(',').map((word) => word.trim()).filter(Boolean),
      links: parsedLinks,
      ...(slug ? {} : address.trim() ? { slug: address.trim() } : {}),
    };
    setSaving(true);
    const result = await adminFetch(slug ? `/api/admin/support/kb/articles/${encodeURIComponent(slug)}` : '/api/admin/support/kb/articles', { method: slug ? 'PUT' : 'POST', json: payload });
    setSaving(false);
    if (!result.ok) { setFieldErrors(result.body.fields ?? {}); return setNotice({ ok: false, text: result.body.error ?? 'Enregistrement impossible.' }); }
    if (!slug) return router.replace(`/admin/support/knowledge-base/articles/${encodeURIComponent(result.body.slug)}`);
    if (nextStatus) setStatus(nextStatus);
    setNotice({ ok: true, text: (nextStatus ?? status) === 'published' ? 'Enregistré et publié.' : 'Brouillon enregistré.' });
    await existing.reload();
  };

  const errorFor = (field: string) => fieldErrors[field]?.[0];

  return (
    <>
      <Link href="/admin/support/knowledge-base" className={`${ghostButton} mb-4`}><ArrowLeft size={15} aria-hidden="true" />Retour à la base de connaissances</Link>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <h1 className="text-xl font-extrabold tracking-tight sm:text-2xl">{slug ? 'Modifier l’article' : 'Nouvel article'}</h1>
        {article && <StateBadge state={article.state} overridden={article.overridden} origin={article.origin} />}
      </div>
      {article?.origin === 'builtin' && !article.overridden && <p className="mb-4 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-[#b7b7bd]">Article intégré : le publier crée une version modifiée qui remplace l’original dans le Centre d’aide. Tant qu’il reste un brouillon, les visiteurs voient l’original, et vous pourrez toujours restaurer l’original.</p>}

      <div className="grid gap-4 xl:grid-cols-2">
        <form onSubmit={(event) => save(event)} noValidate className="space-y-4" data-testid="article-form">
          <Card>
            <div className="space-y-3">
              <label className="block text-xs font-semibold text-[#9a9aa3]">Titre<input value={title} maxLength={KB_LIMITS.titleMax} onChange={(event) => setTitle(event.target.value)} className={`${fieldClass} mt-1`} data-testid="article-title" />{errorFor('title') && <span className="mt-1 block text-red-300">{errorFor('title')}</span>}</label>
              {!slug && <label className="block text-xs font-semibold text-[#9a9aa3]">Adresse (facultatif, générée depuis le titre)<input value={address} maxLength={KB_LIMITS.slugMax} onChange={(event) => setAddress(event.target.value)} placeholder="mon-article" className={`${fieldClass} mt-1`} /></label>}
              <label className="block text-xs font-semibold text-[#9a9aa3]">Rubrique<select value={category} onChange={(event) => setCategory(event.target.value)} className={`${fieldClass} mt-1`}>{HELP_CATEGORIES.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
              <label className="block text-xs font-semibold text-[#9a9aa3]">Résumé<textarea rows={2} value={summary} maxLength={KB_LIMITS.summaryMax} onChange={(event) => setSummary(event.target.value)} className={`${fieldClass} mt-1 resize-y`} data-testid="article-summary" />{errorFor('summary') && <span className="mt-1 block text-red-300">{errorFor('summary')}</span>}</label>
              <label className="block text-xs font-semibold text-[#9a9aa3]">Contenu
                <textarea rows={14} value={content} onChange={(event) => setContent(event.target.value)} className={`${fieldClass} mt-1 resize-y font-mono`} data-testid="article-content" aria-describedby="syntax-help" />
              </label>
              <details id="syntax-help" className="text-xs text-[#8f8f94]"><summary className="cursor-pointer font-semibold">Syntaxe (texte simple, aucun HTML)</summary><pre className="mt-2 whitespace-pre-wrap rounded-lg bg-[#0d0f13] p-3 font-mono">{SYNTAX}</pre></details>
              {(problem || errorFor('content')) && <p role="alert" className="text-sm text-red-300" data-testid="article-problem">{problem ?? errorFor('content')}</p>}
              <label className="block text-xs font-semibold text-[#9a9aa3]">Mots-clés (séparés par des virgules)<input value={keywords} onChange={(event) => setKeywords(event.target.value)} className={`${fieldClass} mt-1`} /></label>
              <label className="block text-xs font-semibold text-[#9a9aa3]">Liens utiles (un par ligne : « Libellé | /chemin-interne »)<textarea rows={3} value={links} onChange={(event) => setLinks(event.target.value)} className={`${fieldClass} mt-1 resize-y font-mono`} /></label>
              <label className="block text-xs font-semibold text-[#9a9aa3]">État<select value={status} onChange={(event) => setStatus(event.target.value)} className={`${fieldClass} mt-1`}><option value="draft">Brouillon</option><option value="published">Publié</option><option value="archived">Masqué</option></select></label>
            </div>
          </Card>
          <div className="flex flex-wrap items-center gap-2">
            <button type="submit" disabled={saving} className={primaryButton} data-testid="article-save"><Save size={15} aria-hidden="true" />{saving ? 'Enregistrement…' : 'Enregistrer'}</button>
            {status !== 'published' && <button type="button" disabled={saving} onClick={(event) => save(event as unknown as React.FormEvent, 'published')} className={ghostButton} data-testid="article-publish">Enregistrer et publier</button>}
          </div>
          {notice && <p role={notice.ok ? 'status' : 'alert'} data-testid="article-notice" className={`text-sm ${notice.ok ? 'text-emerald-300' : 'text-red-300'}`}>{notice.text}</p>}
        </form>

        <Card title="Aperçu">
          <div data-testid="article-preview" className="max-w-prose">
            <h2 className="text-xl font-extrabold">{title || 'Titre de l’article'}</h2>
            <p className="mt-1 text-sm text-[#b7b7bd]">{summary}</p>
            <div className="mt-4"><ArticleBody blocks={blocks} /></div>
            <LinkChips links={parsedLinks.filter((link) => link.label && link.href.startsWith('/') && !link.href.startsWith('//'))} />
          </div>
        </Card>
      </div>
    </>
  );
}
