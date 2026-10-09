'use client';

import React, { useId, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';

export interface AccordionItem {
  id: string;
  title: React.ReactNode;
  content: React.ReactNode;
}

/**
 * Accessible accordion: every title is a real button (aria-expanded / aria-controls) inside a heading, the panel is a
 * labelled region, collapsed content is inert so it cannot be tabbed into or read, and Arrow Up/Down, Home and End move
 * between the titles. Several panels can be open at once. The open/close easing is CSS only and is switched off under
 * prefers-reduced-motion.
 */
export default function Accordion({ items, headingLevel = 3 }: { items: AccordionItem[]; headingLevel?: 2 | 3 | 4 }) {
  const base = useId();
  const [open, setOpen] = useState<Set<string>>(new Set());
  const buttons = useRef<(HTMLButtonElement | null)[]>([]);
  const Heading = `h${headingLevel}` as 'h3';

  const toggle = (id: string) => setOpen((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const onKeyDown = (event: React.KeyboardEvent, index: number) => {
    const last = items.length - 1;
    const target = event.key === 'ArrowDown' ? (index + 1) % items.length : event.key === 'ArrowUp' ? (index - 1 + items.length) % items.length : event.key === 'Home' ? 0 : event.key === 'End' ? last : null;
    if (target === null) return;
    event.preventDefault();
    buttons.current[target]?.focus();
  };

  return (
    <div className="divide-y divide-white/[0.08] overflow-hidden rounded-2xl border border-white/[0.08] bg-[#15171C]">
      {items.map((item, index) => {
        const isOpen = open.has(item.id);
        const buttonId = `${base}-${item.id}-button`;
        const panelId = `${base}-${item.id}-panel`;
        return (
          <div key={item.id} data-accordion-item={item.id}>
            <Heading className="m-0">
              <button
                ref={(element) => { buttons.current[index] = element; }}
                id={buttonId}
                type="button"
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => toggle(item.id)}
                onKeyDown={(event) => onKeyDown(event, index)}
                className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-[15px] font-semibold text-white transition-colors hover:bg-white/[0.04] focus-visible:bg-white/[0.04] focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none sm:px-6"
              >
                <span>{item.title}</span>
                <ChevronDown size={18} aria-hidden="true" className={`shrink-0 text-[#8f8f94] transition-transform duration-300 motion-reduce:transition-none ${isOpen ? 'rotate-180 text-primary' : ''}`} />
              </button>
            </Heading>
            <div
              id={panelId}
              role="region"
              aria-labelledby={buttonId}
              inert={!isOpen}
              className={`grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none ${isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
            >
              <div className="overflow-hidden">
                <div className="px-5 pb-5 text-sm leading-relaxed text-[#b7b7bd] sm:px-6">{item.content}</div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
