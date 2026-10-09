'use client';

import React, { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Search, SearchX, X } from 'lucide-react';
import { HELP_CATEGORIES, articlesInCategory, articleBySlug, categoryById, type CategoryId } from '@/lib/help-content';
import { searchArticles, searchFaq } from '@/lib/help-search';
import Accordion from './Accordion';
import HelpShell from './HelpShell';
import SupportSection from './SupportSection';
import { CategoryIcon, LinkChips } from './HelpParts';

// A short, curated "start here" list shown when nothing is searched or selected.
const FEATURED = ['creer-un-profil', 'ouvrir-un-profil-avec-son-code-pin', 'code-pin-oublie', 'disponibilite-des-contenus', 'changer-le-mot-de-passe', 'signaler-un-probleme'];

export default function HelpCenter() {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<CategoryId | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtering = query.trim() !== '' || category !== null;
  const articles = useMemo(() => (filtering ? searchArticles(query, category) : FEATURED.map((slug) => articleBySlug(slug)!).filter(Boolean)), [filtering, query, category]);
  const faqs = useMemo(() => searchFaq(query, category), [query, category]);
  const empty = filtering && articles.length === 0 && faqs.length === 0;
  const activeCategory = category ? categoryById(category) : null;

  const clear = () => { setQuery(''); setCategory(null); inputRef.current?.focus(); };

  return (
    <HelpShell>
      <header className="relative overflow-hidden border-b border-white/[0.06] pt-[66px]">
        <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-0 h-[420px] w-[900px] max-w-[160vw] -translate-x-1/2 bg-[radial-gradient(ellipse_at_center_top,rgba(229,9,20,0.28),rgba(229,9,20,0.07)_45%,transparent_70%)]" />
        <div className="relative mx-auto max-w-3xl px-4 pb-14 pt-14 text-center sm:px-6 sm:pt-20">
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-5xl">Comment pouvons-nous vous aider&nbsp;?</h1>
          <p className="mx-auto mt-3 max-w-xl text-sm text-[#a9a9b1] sm:text-base">Trouvez rapidement des réponses à vos questions sur CINEVERSE.</p>

          <form role="search" onSubmit={(event) => event.preventDefault()} className="relative mx-auto mt-8 max-w-2xl">
            <label htmlFor="help-search" className="sr-only">Rechercher une question ou un problème</label>
            <Search size={20} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#8f8f94] sm:left-4" />
            <input
              ref={inputRef}
              id="help-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => { if (event.key === 'Escape' && query) { event.preventDefault(); setQuery(''); } }}
              placeholder="Rechercher une question ou un problème..."
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="search"
              aria-describedby="help-results-status"
              className={`w-full rounded-2xl border border-white/12 bg-[#15171C] py-4 pl-10 text-base text-white sm:pl-12 ${query ? 'pr-12' : 'pr-3 sm:pr-4'} placeholder:text-[11px] placeholder:text-[#6f6f78] min-[360px]:placeholder:text-[13px] min-[400px]:placeholder:text-sm sm:placeholder:text-base shadow-[0_18px_50px_rgba(0,0,0,0.35)] transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/30 [&::-webkit-search-cancel-button]:hidden`}
            />
            {query && (
              <button type="button" onClick={() => { setQuery(''); inputRef.current?.focus(); }} aria-label="Effacer la recherche" className="absolute right-3 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full text-[#9a9aa3] hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"><X size={17} aria-hidden="true" /></button>
            )}
          </form>
          <p id="help-results-status" role="status" aria-live="polite" className="mt-3 min-h-5 text-xs text-[#8f8f94]">
            {filtering ? `${articles.length} article${articles.length > 1 ? 's' : ''} et ${faqs.length} question${faqs.length > 1 ? 's' : ''} trouvé${articles.length + faqs.length > 1 ? 's' : ''}` : ''}
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-6xl space-y-14 px-4 py-12 sm:px-6 lg:px-8">
        <section aria-labelledby="categories-title">
          <h2 id="categories-title" className="mb-5 text-xl font-bold">Parcourir par thème</h2>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {HELP_CATEGORIES.map((item) => {
              const selected = category === item.id;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    aria-pressed={selected}
                    data-category={item.id}
                    onClick={() => setCategory(selected ? null : item.id)}
                    className={`group flex h-full w-full items-start gap-4 rounded-2xl border bg-[#15171C] p-5 text-left transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary motion-reduce:transition-none motion-reduce:hover:translate-y-0 ${selected ? 'border-primary shadow-[0_0_0_1px_rgba(229,9,20,0.4),0_14px_40px_rgba(229,9,20,0.12)]' : 'border-white/[0.08]'}`}
                  >
                    <span className={`grid size-11 shrink-0 place-items-center rounded-xl transition-colors ${selected ? 'bg-primary text-white' : 'bg-primary/10 text-primary'}`}><CategoryIcon icon={item.icon} /></span>
                    <span className="min-w-0">
                      <span className="block text-base font-bold text-white">{item.title}</span>
                      <span className="mt-1 block text-sm text-[#9a9aa3]">{item.description}</span>
                      <span className="mt-2 block text-xs font-semibold text-primary">{articlesInCategory(item.id).length} articles</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        <section aria-labelledby="articles-title" data-testid="articles-section">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <h2 id="articles-title" className="text-xl font-bold">
              {query.trim() ? `Articles pour « ${query.trim()} »` : activeCategory ? `Articles : ${activeCategory.title}` : 'Pour commencer'}
            </h2>
            {filtering && <button type="button" onClick={clear} className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 px-3 py-1.5 text-sm font-semibold text-[#d7d7da] hover:border-white/40 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"><ArrowLeft size={14} aria-hidden="true" />Tout afficher</button>}
          </div>
          {articles.length > 0 ? (
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" data-testid="article-list">
              {articles.map((article) => (
                <li key={article.slug}>
                  <Link href={`/help/${article.slug}`} className="group flex h-full flex-col rounded-2xl border border-white/[0.08] bg-[#15171C] p-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary motion-reduce:transition-none motion-reduce:hover:translate-y-0">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-primary">{categoryById(article.category)?.title}</span>
                    <span className="mt-1.5 text-[15px] font-bold text-white">{article.title}</span>
                    <span className="mt-1.5 flex-1 text-sm text-[#9a9aa3]">{article.summary}</span>
                    <span className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-white/80 group-hover:text-primary">Lire l’article<ArrowRight size={13} aria-hidden="true" /></span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : filtering ? <p className="text-sm text-[#9a9aa3]">Aucun article ne correspond.</p> : null}
        </section>

        <section id="faq" aria-labelledby="faq-title" className="scroll-mt-24" data-testid="faq-section">
          <h2 id="faq-title" className="mb-5 text-xl font-bold">Questions fréquentes</h2>
          {faqs.length > 0 ? (
            <Accordion
              key={`${category ?? 'all'}|${query}`}
              items={faqs.map((faq) => ({
                id: faq.id,
                title: faq.question,
                content: (
                  <>
                    <p>{faq.answer}</p>
                    <LinkChips links={[...(faq.links ?? []), { label: 'Lire l’article complet', href: `/help/${faq.article}` }]} />
                  </>
                ),
              }))}
            />
          ) : filtering ? <p className="text-sm text-[#9a9aa3]">Aucune question ne correspond.</p> : null}
        </section>

        {empty && (
          <div role="status" data-testid="no-results" className="rounded-2xl border border-white/[0.08] bg-[#15171C] px-6 py-10 text-center">
            <SearchX size={34} aria-hidden="true" className="mx-auto text-[#6f6f78]" />
            <p className="mt-4 text-lg font-bold">Aucun résultat{query.trim() ? ` pour « ${query.trim()} »` : ''}</p>
            <p className="mx-auto mt-2 max-w-md text-sm text-[#9a9aa3]">Essayez avec d’autres mots, vérifiez l’orthographe, ou parcourez les thèmes ci-dessus.</p>
            <div className="mt-5 flex flex-wrap justify-center gap-3">
              <button type="button" onClick={clear} className="rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-white hover:bg-primary-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">Effacer la recherche</button>
              <a href="#contact" className="rounded-lg border border-white/15 px-4 py-2.5 text-sm font-semibold text-[#d7d7da] hover:border-white/40 hover:text-white">Voir comment obtenir de l’aide</a>
            </div>
          </div>
        )}

        <SupportSection />

        <div className="flex justify-center pb-4">
          <Link href="/" className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-5 py-2.5 text-sm font-semibold text-[#d7d7da] transition-colors hover:border-white/40 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"><ArrowLeft size={16} aria-hidden="true" />Retour à CINEVERSE</Link>
        </div>
      </div>
    </HelpShell>
  );
}

