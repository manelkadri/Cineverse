'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowLeft, BarChart3, BookOpen, Bell, ChevronRight, LayoutDashboard, LifeBuoy, Menu, Settings, UserRound, X } from 'lucide-react';
import CineverseLogo from '@/components/CineverseLogo';

export const ADMIN_NOTIFICATIONS_CHANGED = 'admin-notifications-changed';

const NAV = [
  { label: 'Vue d’ensemble', href: '/admin/support', icon: LayoutDashboard, match: (path: string) => path === '/admin/support' },
  { label: 'Demandes d’aide', href: '/admin/support/tickets', icon: LifeBuoy, match: (path: string) => path.startsWith('/admin/support/tickets') },
  { label: 'Notifications', href: '/admin/support/notifications', icon: Bell, match: (path: string) => path.startsWith('/admin/support/notifications') || path.startsWith('/admin/announcements'), badge: true },
  { label: 'Base de connaissances', href: '/admin/support/knowledge-base', icon: BookOpen, match: (path: string) => path.startsWith('/admin/support/knowledge-base') },
  { label: 'Statistiques', href: '/admin/support/analytics', icon: BarChart3, match: (path: string) => path.startsWith('/admin/support/analytics') },
  { label: 'Paramètres', href: '/admin/support/settings', icon: Settings, match: (path: string) => path.startsWith('/admin/support/settings') || path.startsWith('/admin/support/audit') },
];

const CRUMBS: Record<string, string> = {
  support: 'Support', tickets: 'Demandes d’aide', notifications: 'Notifications', 'knowledge-base': 'Base de connaissances', analytics: 'Statistiques',
  settings: 'Paramètres', audit: 'Journal d’audit', announcements: 'Annonces', articles: 'Articles', new: 'Nouvel article',
};

function breadcrumbs(pathname: string) {
  const parts = pathname.split('/').filter(Boolean).slice(1); // after "admin"
  const crumbs: { label: string; href: string }[] = [];
  let href = '/admin';
  parts.forEach((part, index) => {
    href += `/${part}`;
    const previous = parts[index - 1];
    const label = CRUMBS[part] ?? (previous === 'tickets' ? 'Ticket' : previous === 'articles' ? 'Article' : part);
    crumbs.push({ label, href });
  });
  return crumbs;
}

function initials(name: string, email: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return (words.length > 1 ? words[0][0] + words[words.length - 1][0] : (words[0] ?? email).slice(0, 2)).toUpperCase();
}

/**
 * The frame of every administration page: a fixed sidebar on desktop, a drawer on small screens, a header with the breadcrumb
 * and the signed-in administrator, and a permanent way back to CINEVERSE. It is only rendered for support administrators (the
 * layout checks that on the server before it renders this component).
 */
export default function AdminShell({ name, email, children }: { name: string; email: string; children: React.ReactNode }) {
  const pathname = usePathname() ?? '';
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const drawerRef = useRef<HTMLDivElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);

  const refreshUnread = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/support/me', { cache: 'no-store' });
      if (response.ok) setUnread((await response.json()).unreadNotifications ?? 0);
    } catch { /* keep the last value */ }
  }, []);
  useEffect(() => {
    void refreshUnread();
    window.addEventListener(ADMIN_NOTIFICATIONS_CHANGED, refreshUnread);
    return () => window.removeEventListener(ADMIN_NOTIFICATIONS_CHANGED, refreshUnread);
  }, [refreshUnread]);

  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(() => {
    if (!open) return;
    drawerRef.current?.querySelector<HTMLElement>('a, button')?.focus();
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') { setOpen(false); menuButton.current?.focus(); } };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [open]);

  const nav = (
    <nav aria-label="Administration du support" className="flex flex-1 flex-col gap-1 px-3 py-4">
      {NAV.map((item) => {
        const active = item.match(pathname);
        return (
          <Link key={item.href} href={item.href} aria-current={active ? 'page' : undefined} data-nav={item.label}
            className={`group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors motion-reduce:transition-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${active ? 'bg-primary/10 text-white' : 'text-[#a9a9b1] hover:bg-white/[0.05] hover:text-white'}`}>
            {active && <span aria-hidden="true" className="absolute inset-y-1.5 left-0 w-[3px] rounded-full bg-primary" />}
            <item.icon size={18} className={active ? 'text-primary' : 'text-[#7d7d86] group-hover:text-white'} aria-hidden="true" />
            <span className="flex-1">{item.label}</span>
            {item.badge && unread > 0 && <span data-testid="admin-unread-badge" className="grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1.5 text-[10px] font-extrabold text-white" aria-label={`${unread} non lue${unread > 1 ? 's' : ''}`}>{unread > 99 ? '99+' : unread}</span>}
          </Link>
        );
      })}
      <div className="mt-auto space-y-1 border-t border-white/[0.08] pt-4">
        <Link href="/account" className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-[#a9a9b1] hover:bg-white/[0.05] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"><UserRound size={18} aria-hidden="true" />Mon compte</Link>
        <Link href="/" data-testid="back-to-site" className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-bold text-white hover:bg-primary/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"><ArrowLeft size={18} className="text-primary" aria-hidden="true" />Retour à CINEVERSE</Link>
      </div>
    </nav>
  );

  const crumbs = breadcrumbs(pathname);

  return (
    <div className="min-h-screen bg-[#08090D] text-white lg:pl-64" data-admin-shell>
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-white/[0.08] bg-[#101116] lg:flex">
        <div className="flex h-16 items-center border-b border-white/[0.08] px-5"><Link href="/admin/support" aria-label="Administration CINEVERSE" className="leading-none"><CineverseLogo className="text-[24px]" /></Link></div>
        {nav}
      </aside>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu d’administration">
          <button type="button" aria-label="Fermer le menu" onClick={() => setOpen(false)} className="absolute inset-0 bg-black/70" />
          <div ref={drawerRef} className="relative flex h-full w-72 max-w-[85vw] flex-col border-r border-white/[0.08] bg-[#101116]">
            <div className="flex h-16 items-center justify-between border-b border-white/[0.08] px-4">
              <CineverseLogo className="text-[22px]" />
              <button type="button" onClick={() => { setOpen(false); menuButton.current?.focus(); }} aria-label="Fermer le menu" className="grid size-9 place-items-center rounded-full text-[#d7d7da] hover:bg-white/10"><X size={20} aria-hidden="true" /></button>
            </div>
            <div className="flex-1 overflow-y-auto">{nav}</div>
          </div>
        </div>
      )}

      <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-white/[0.08] bg-[#08090D]/90 px-4 sm:px-6 nav-blur">
        <button ref={menuButton} type="button" onClick={() => setOpen(true)} aria-label="Ouvrir le menu d’administration" aria-expanded={open} data-testid="admin-menu-button" className="grid size-10 place-items-center rounded-full text-[#d7d7da] hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary lg:hidden"><Menu size={22} aria-hidden="true" /></button>
        <nav aria-label="Fil d’Ariane" className="min-w-0 flex-1">
          <ol className="flex items-center gap-1.5 overflow-hidden whitespace-nowrap text-sm text-[#8f8f94]">
            <li className="hidden sm:block">Administration</li>
            {crumbs.map((crumb, index) => (
              <li key={crumb.href} className="flex min-w-0 items-center gap-1.5">
                <ChevronRight size={13} aria-hidden="true" className={index === 0 ? 'hidden sm:block' : ''} />
                {index === crumbs.length - 1 ? <span aria-current="page" className="truncate font-semibold text-white">{crumb.label}</span> : <Link href={crumb.href} className="truncate hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">{crumb.label}</Link>}
              </li>
            ))}
          </ol>
        </nav>
        <div className="flex shrink-0 items-center gap-3" data-testid="admin-account">
          <div className="hidden text-right sm:block"><p className="max-w-[12rem] truncate text-sm font-semibold">{name}</p><p className="max-w-[12rem] truncate text-xs text-[#8f8f94]">{email}</p></div>
          <span aria-hidden="true" className="grid size-9 place-items-center rounded-full border-2 border-primary bg-[#17191F] text-xs font-extrabold">{initials(name, email)}</span>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">{children}</main>
    </div>
  );
}
