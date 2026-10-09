import React from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowRight, Bookmark, Clapperboard, Info, KeyRound, ShieldCheck, UserCog, Wrench } from 'lucide-react';
import type { HelpBlock, HelpCategory, HelpLink } from '@/lib/help-content';

const ICONS = { 'user-cog': UserCog, 'key-round': KeyRound, clapperboard: Clapperboard, bookmark: Bookmark, 'shield-check': ShieldCheck, wrench: Wrench } as const;

export function CategoryIcon({ icon, size = 22, className }: { icon: HelpCategory['icon']; size?: number; className?: string }) {
  const Icon = ICONS[icon];
  return <Icon size={size} className={className} aria-hidden="true" />;
}

/** Internal links only (the content module is checked by tests/help.test.ts): anchors on the same page use plain links. */
export function LinkChips({ links }: { links: HelpLink[] }) {
  if (!links.length) return null;
  return (
    <ul className="mt-3 flex flex-wrap gap-2">
      {links.map((link) => (
        <li key={link.href + link.label}>
          <Link href={link.href} className="inline-flex items-center gap-1.5 rounded-full border border-white/12 px-3.5 py-1.5 text-[13px] font-semibold text-[#d7d7da] transition-colors hover:border-primary hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary motion-reduce:transition-none">
            {link.label}<ArrowRight size={13} aria-hidden="true" />
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function ArticleBody({ blocks }: { blocks: HelpBlock[] }) {
  return (
    <div className="space-y-4 text-[15px] leading-relaxed text-[#c3c3c9]">
      {blocks.map((block, index) => {
        switch (block.type) {
          case 'h':
            return <h2 key={index} className="pt-2 text-lg font-bold text-white">{block.text}</h2>;
          case 'p':
            return <p key={index}>{block.text}</p>;
          case 'steps':
            return (
              <ol key={index} className="space-y-2.5">
                {block.items.map((item, itemIndex) => (
                  <li key={itemIndex} className="flex gap-3">
                    <span aria-hidden="true" className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-primary/15 text-xs font-bold text-primary">{itemIndex + 1}</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ol>
            );
          case 'list':
            return (
              <ul key={index} className="space-y-2">
                {block.items.map((item, itemIndex) => (
                  <li key={itemIndex} className="flex gap-3"><span aria-hidden="true" className="mt-2.5 size-1.5 shrink-0 rounded-full bg-primary" /><span>{item}</span></li>
                ))}
              </ul>
            );
          case 'note':
            return <p key={index} className="flex gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm"><Info size={18} className="mt-0.5 shrink-0 text-[#9a9aa3]" aria-hidden="true" /><span>{block.text}</span></p>;
          case 'warning':
            return <p key={index} role="note" className="flex gap-3 rounded-xl border border-amber-400/25 bg-amber-400/[0.07] px-4 py-3 text-sm text-amber-50"><AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-300" aria-hidden="true" /><span>{block.text}</span></p>;
        }
      })}
    </div>
  );
}
