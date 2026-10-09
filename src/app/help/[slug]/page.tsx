import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import HelpShell from '@/components/help/HelpShell';
import SupportSection from '@/components/help/SupportSection';
import { ArticleBody, CategoryIcon, LinkChips } from '@/components/help/HelpParts';
import { categoryById } from '@/lib/help-content';
import { loadPublishedKnowledgeBase } from '@/lib/kb-server';
import { loadAvailability, loadCategories } from '@/lib/support-server';

// Only PUBLISHED articles exist (built-in content plus published knowledge-base edits); any other address, including a draft or a
// hidden article, is a real 404.
export const revalidate = 3600;

export async function generateStaticParams() {
  return (await loadPublishedKnowledgeBase()).articles.map((article) => ({ slug: article.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const slug = (await params).slug;
  const article = (await loadPublishedKnowledgeBase()).articles.find((item) => item.slug === slug);
  if (!article) return { title: 'Article introuvable — Centre d’aide CINEVERSE' };
  return {
    title: `${article.title} — Centre d’aide CINEVERSE`,
    description: article.summary,
    alternates: { canonical: `/help/${article.slug}` },
  };
}

export default async function HelpArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const slug = (await params).slug;
  const [{ articles }, contactCategories, availability] = await Promise.all([loadPublishedKnowledgeBase(), loadCategories(), loadAvailability()]);
  const article = articles.find((item) => item.slug === slug);
  if (!article) notFound();
  const category = categoryById(article.category)!;
  const related = articles.filter((item) => item.category === article.category && item.slug !== article.slug).slice(0, 4);

  return (
    <HelpShell>
      <div className="relative overflow-hidden pt-[66px]">
        <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-0 h-[260px] w-[800px] max-w-[160vw] -translate-x-1/2 bg-[radial-gradient(ellipse_at_center_top,rgba(229,9,20,0.18),transparent_70%)]" />
        <div className="relative mx-auto max-w-3xl px-4 pb-10 pt-10 sm:px-6">
          <nav aria-label="Fil d’Ariane">
            <ol className="flex flex-wrap items-center gap-1.5 text-xs text-[#8f8f94]">
              <li><Link href="/help" className="hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">Centre d’aide</Link></li>
              <li aria-hidden="true"><ChevronRight size={12} /></li>
              <li>{category.title}</li>
              <li aria-hidden="true"><ChevronRight size={12} /></li>
              <li aria-current="page" className="text-[#d7d7da]">{article.title}</li>
            </ol>
          </nav>
          <p className="mt-6 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary"><CategoryIcon icon={category.icon} size={15} />{category.title}</p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl" data-testid="article-title">{article.title}</h1>
          <p className="mt-3 text-base text-[#a9a9b1]">{article.summary}</p>
        </div>
      </div>

      <article className="mx-auto max-w-3xl px-4 pb-12 sm:px-6" data-testid="article-body">
        <div className="rounded-2xl border border-white/[0.08] bg-[#15171C] p-5 sm:p-8">
          <ArticleBody blocks={article.body} />
        </div>
        {article.links.length > 0 && (
          <section aria-labelledby="links-title" className="mt-8">
            <h2 id="links-title" className="text-sm font-bold uppercase tracking-wider text-[#8f8f94]">Liens utiles</h2>
            <LinkChips links={article.links} />
          </section>
        )}
        {related.length > 0 && (
          <section aria-labelledby="related-title" className="mt-10">
            <h2 id="related-title" className="text-lg font-bold">Dans la même rubrique</h2>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {related.map((item) => (
                <li key={item.slug}>
                  <Link href={`/help/${item.slug}`} className="block h-full rounded-xl border border-white/[0.08] bg-[#15171C] p-4 transition-colors hover:border-primary/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary motion-reduce:transition-none">
                    <span className="text-sm font-bold">{item.title}</span>
                    <span className="mt-1 block text-xs text-[#9a9aa3]">{item.summary}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
        <div className="mt-10"><SupportSection categories={contactCategories.filter((item) => item.enabled).map((item) => ({ id: item.id, label: item.label }))} availability={availability.enabled && availability.text ? availability.text : null} /></div>
        <div className="mt-8"><Link href="/help" className="inline-flex items-center gap-2 text-sm font-semibold text-[#d7d7da] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"><ArrowLeft size={16} aria-hidden="true" />Retour au Centre d’aide</Link></div>
      </article>
    </HelpShell>
  );
}
