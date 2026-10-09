import React from 'react';
import Link from 'next/link';
import { ArrowLeft, FileWarning } from 'lucide-react';
import HelpShell from '@/components/help/HelpShell';

/** Page frame for the footer documents (privacy, cookies, terms, accessibility, legal notice). They are drafts for the owner to review. */
export function LegalDocument({ title, intro, children }: { title: string; intro: string; children: React.ReactNode }) {
  return (
    <HelpShell>
      <div className="relative overflow-hidden pt-[66px]">
        <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-0 h-[240px] w-[800px] max-w-[160vw] -translate-x-1/2 bg-[radial-gradient(ellipse_at_center_top,rgba(229,9,20,0.16),transparent_70%)]" />
        <div className="relative mx-auto max-w-3xl px-4 pb-8 pt-12 sm:px-6">
          <h1 className="text-2xl font-extrabold tracking-tight min-[400px]:text-3xl sm:text-4xl" data-testid="legal-title">{title}</h1>
          <p className="mt-3 text-base text-[#a9a9b1]">{intro}</p>
        </div>
      </div>
      <article className="mx-auto max-w-3xl px-4 pb-16 sm:px-6">
        <p role="note" data-testid="draft-banner" className="mb-8 flex gap-3 rounded-xl border border-amber-400/30 bg-amber-400/[0.08] px-4 py-3.5 text-sm leading-relaxed text-amber-50">
          <FileWarning size={20} className="mt-0.5 shrink-0 text-amber-300" aria-hidden="true" />
          <span><strong>Projet de document, à relire par le propriétaire avant publication.</strong> Il décrit le fonctionnement réel de CINEVERSE à la date indiquée, mais ne constitue pas un avis juridique. Les passages en <Todo>à compléter</Todo> doivent être renseignés ou validés (idéalement par un juriste) avant toute mise en ligne publique.</span>
        </p>
        <div className="space-y-9">{children}</div>
        <p className="mt-10 text-xs text-[#8f8f94]">Dernière mise à jour du projet : 9 octobre 2026.</p>
        <div className="mt-8"><Link href="/help" className="inline-flex items-center gap-2 text-sm font-semibold text-[#d7d7da] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"><ArrowLeft size={16} aria-hidden="true" />Retour au Centre d’aide</Link></div>
      </article>
    </HelpShell>
  );
}

export function LegalSection({ id, title, children }: { id?: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id ?? title}-title`} className="scroll-mt-24">
      <h2 id={`${id ?? title}-title`} className="text-xl font-bold text-white">{title}</h2>
      <div className="mt-3 space-y-3 text-[15px] leading-relaxed text-[#c3c3c9]">{children}</div>
    </section>
  );
}

/** A value only the site owner can supply or confirm. Rendered conspicuously so it cannot be published by accident. */
export function Todo({ children }: { children: React.ReactNode }) {
  return <mark data-todo className="rounded bg-amber-400/20 px-1.5 py-0.5 font-bold text-amber-200">[À compléter : {children}]</mark>;
}

export function Bullets({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="space-y-2">
      {items.map((item, index) => <li key={index} className="flex gap-3"><span aria-hidden="true" className="mt-2.5 size-1.5 shrink-0 rounded-full bg-primary" /><span>{item}</span></li>)}
    </ul>
  );
}

export function DataTable({ head, rows }: { head: string[]; rows: React.ReactNode[][] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-white/[0.08]">
      <table className="w-full min-w-[34rem] border-collapse text-left text-sm">
        <thead className="bg-white/[0.04] text-xs uppercase tracking-wider text-[#9a9aa3]"><tr>{head.map((cell) => <th key={cell} scope="col" className="px-4 py-3 font-semibold">{cell}</th>)}</tr></thead>
        <tbody className="divide-y divide-white/[0.06]">{rows.map((row, index) => <tr key={index} className="align-top">{row.map((cell, cellIndex) => <td key={cellIndex} className="px-4 py-3">{cell}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}
