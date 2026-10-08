'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Bell,
  Check,
  ChevronDown,
  CircleHelp,
  ExternalLink,
  Home,
  LockKeyhole,
  LogOut,
  ListVideo,
  Menu,
  Pencil,
  Search,
  Send,
  UserRound,
  X,
} from 'lucide-react';

const navigation = [
  { label: 'Accueil', href: '/' },
  { label: 'Films', href: '/films-series-catalog' },
  { label: 'Séries', href: '/films-series-catalog' },
  { label: 'Ma liste', href: '/profiles' },
];

export default function Navbar() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 24);
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (!profileMenuOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (!profileMenuRef.current?.contains(event.target as Node)) {
        setProfileMenuOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setProfileMenuOpen(false);
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [profileMenuOpen]);

  const isActive = (label: string, href: string) => {
    if (label === 'Accueil') return pathname === '/';
    if (label === 'Films') return pathname === href;
    if (label === 'Ma liste') return pathname === href;
    return false;
  };

  return (
    <>
      <nav
        className={`fixed inset-x-0 top-0 z-50 border-t border-white/[0.08] transition-colors duration-300 nav-blur ${
          scrolled
            ? 'border-b border-white/10 bg-[#050608]/95 shadow-xl shadow-black/30'
            : 'bg-gradient-to-b from-black/95 via-black/70 to-black/10'
        }`}
        aria-label="Navigation principale"
      >
        <div className="mx-auto max-w-screen-2xl px-5 sm:px-7 lg:px-10">
          <div className="flex h-[66px] items-center justify-between">
            <div className="flex min-w-0 items-center gap-9 lg:gap-12">
              <Link
                href="/"
                className="shrink-0 leading-none"
                aria-label="Cineverse - Accueil"
              >
                <span className="font-display text-[21px] tracking-[0.015em]">
                  <span className="text-[#f00816]">CINE</span>
                  <span className="text-[#f1f1f1]">VERSE</span>
                </span>
              </Link>

              <div className="hidden items-stretch gap-7 md:flex">
                {navigation.map((item) => {
                  const active = isActive(item.label, item.href);

                  return (
                    <Link
                      key={`nav-${item.label}`}
                      href={item.href}
                      aria-current={active ? 'page' : undefined}
                      className={`relative flex h-[66px] items-center text-[14px] font-semibold transition-colors duration-200 after:absolute after:inset-x-0 after:bottom-[12px] after:h-[2px] after:origin-left after:rounded-full after:bg-[#f00816] after:transition-transform after:duration-200 ${
                        active
                          ? 'text-[#f2f2f2] after:scale-x-100'
                          : 'text-[#a9a9ad] after:scale-x-0 hover:text-white hover:after:scale-x-100'
                      }`}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center gap-1 sm:gap-2">
              {searchOpen ? (
                <div className="flex items-center gap-2 rounded-full border border-white/20 bg-black/65 px-3 py-2">
                  <Search size={20} strokeWidth={2.2} className="shrink-0 text-[#d6d6d8]" />
                  <input
                    autoFocus
                    type="search"
                    placeholder="Rechercher..."
                    className="w-28 bg-transparent text-sm text-white outline-none placeholder:text-[#85858b] sm:w-40"
                    onBlur={() => setSearchOpen(false)}
                    onKeyDown={(event) => {
                      if (event.key === 'Escape') setSearchOpen(false);
                    }}
                  />
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setSearchOpen(true)}
                  className="grid size-10 place-items-center rounded-full text-[#d6d6d8] transition-colors hover:bg-white/10 hover:text-white"
                  aria-label="Rechercher"
                >
                  <Search size={24} strokeWidth={2.2} />
                </button>
              )}

              <button
                type="button"
                className="relative grid size-10 place-items-center rounded-full text-[#d6d6d8] transition-colors hover:bg-white/10 hover:text-white"
                aria-label="Notifications"
              >
                <Bell size={22} strokeWidth={2.2} />
                <span className="absolute right-[8px] top-[7px] size-1.5 rounded-full bg-[#f00816] ring-2 ring-black" />
              </button>

              <div ref={profileMenuRef} className="relative ml-1">
                <button
                  type="button"
                  onClick={() => setProfileMenuOpen((open) => !open)}
                  className="group flex items-center gap-1"
                  aria-label="Ouvrir le menu du profil"
                  aria-haspopup="menu"
                  aria-expanded={profileMenuOpen}
                  aria-controls="profile-menu"
                >
                  <span className="grid size-9 place-items-center rounded-full border-2 border-[#e50914] bg-[#17191d] text-[#bfc0c4] shadow-[0_0_0_2px_rgba(0,0,0,0.7)] transition-colors group-hover:bg-[#24272d] group-hover:text-white">
                    <UserRound size={19} strokeWidth={2} />
                  </span>
                  <ChevronDown
                    size={14}
                    className={`hidden text-[#8f8f94] transition-transform duration-200 group-hover:text-white lg:block ${
                      profileMenuOpen ? 'rotate-180 text-white' : ''
                    }`}
                  />
                </button>

                {profileMenuOpen && (
                  <div
                    id="profile-menu"
                    role="menu"
                    className="absolute right-0 top-[49px] w-72 max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-xl border border-white/[0.12] bg-[#111418]/98 text-white shadow-[0_24px_80px_rgba(0,0,0,0.7)] ring-1 ring-black/50 nav-blur sm:w-80"
                  >
                    <span className="absolute right-4 top-[-6px] size-3 rotate-45 border-l border-t border-white/[0.12] bg-[#111418]" />

                    <div className="border-b border-white/[0.08] p-2">
                      <button
                        type="button"
                        role="menuitem"
                        className="flex w-full items-center gap-3 rounded-lg bg-white/[0.07] px-3 py-2.5 text-left transition-colors hover:bg-white/[0.11]"
                      >
                        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-[#e50914] to-[#710710] text-sm font-extrabold shadow-lg">
                          A
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-bold">Alex</span>
                          <span className="block text-[11px] text-[#999da4]">Profil actif</span>
                        </span>
                        <span className="grid size-5 place-items-center rounded-full bg-primary">
                          <Check size={12} strokeWidth={3} />
                        </span>
                      </button>

                      <button
                        type="button"
                        role="menuitem"
                        className="mt-1 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-[#d7d7da] transition-colors hover:bg-white/[0.07] hover:text-white"
                      >
                        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-[#db4773] to-[#6e1634] text-sm font-extrabold">
                          S
                        </span>
                        <span className="flex-1 text-sm font-semibold">Sophie</span>
                        <LockKeyhole size={17} className="text-[#94979d]" />
                      </button>

                      <button
                        type="button"
                        role="menuitem"
                        className="mt-1 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-[#d7d7da] transition-colors hover:bg-white/[0.07] hover:text-white"
                      >
                        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-[#1db987] to-[#0b6257] text-sm font-extrabold">
                          E
                        </span>
                        <span className="flex-1 text-sm font-semibold">Enfants</span>
                        <LockKeyhole size={17} className="text-[#94979d]" />
                      </button>
                    </div>

                    <div className="p-2">
                      <Link
                        href="/profiles"
                        role="menuitem"
                        onClick={() => setProfileMenuOpen(false)}
                        className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-[#d7d7da] transition-colors hover:bg-white/[0.07] hover:text-white"
                      >
                        <Pencil size={20} className="text-[#aeb0b5]" />
                        Gérer les profils
                      </Link>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => setProfileMenuOpen(false)}
                        className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-[#d7d7da] transition-colors hover:bg-white/[0.07] hover:text-white"
                      >
                        <ExternalLink size={20} className="text-[#aeb0b5]" />
                        Quitter le profil
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-[#d7d7da] transition-colors hover:bg-white/[0.07] hover:text-white"
                      >
                        <Send size={20} className="text-[#aeb0b5]" />
                        Transférer le profil
                      </button>
                      <Link
                        href="/profiles"
                        role="menuitem"
                        onClick={() => setProfileMenuOpen(false)}
                        className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-[#d7d7da] transition-colors hover:bg-white/[0.07] hover:text-white"
                      >
                        <UserRound size={20} className="text-[#aeb0b5]" />
                        Compte
                      </Link>
                      <button
                        type="button"
                        role="menuitem"
                        className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-[#d7d7da] transition-colors hover:bg-white/[0.07] hover:text-white"
                      >
                        <CircleHelp size={20} className="text-[#aeb0b5]" />
                        Centre d'aide
                      </button>
                    </div>

                    <div className="border-t border-white/[0.08] p-2">
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => setProfileMenuOpen(false)}
                        className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-bold text-[#e3e3e5] transition-colors hover:bg-primary/15 hover:text-white"
                      >
                        <LogOut size={20} className="text-primary" />
                        Se déconnecter de CINEVERSE
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <button
                type="button"
                className="ml-1 grid size-10 place-items-center rounded-full text-[#d6d6d8] transition-colors hover:bg-white/10 hover:text-white md:hidden"
                onClick={() => setMobileOpen((open) => !open)}
                aria-label={mobileOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
                aria-expanded={mobileOpen}
              >
                {mobileOpen ? <X size={23} /> : <Menu size={23} />}
              </button>
            </div>
          </div>
        </div>

        {mobileOpen && (
          <div className="border-t border-white/10 bg-[#08090b]/98 px-5 py-2 md:hidden">
            {navigation.map((item) => {
              const active = isActive(item.label, item.href);

              return (
                <Link
                  key={`mobile-nav-${item.label}`}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={`flex items-center border-l-2 px-4 py-3 text-sm font-semibold transition-colors ${
                    active
                      ? 'border-[#f00816] bg-white/[0.05] text-white'
                      : 'border-transparent text-[#a9a9ad] hover:bg-white/[0.04] hover:text-white'
                  }`}
                  onClick={() => setMobileOpen(false)}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        )}
      </nav>

      <nav
        className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-[#08090b]/95 nav-blur md:hidden"
        aria-label="Navigation mobile"
      >
        <div className="flex items-center justify-around px-2 py-2">
          {[
            { label: 'Accueil', href: '/', icon: Home },
            { label: 'Recherche', href: '/films-series-catalog', icon: Search },
            { label: 'Ma liste', href: '/profiles', icon: ListVideo },
            { label: 'Profil', href: '/profiles', icon: UserRound },
          ].map((item) => {
            const Icon = item.icon;
            const active =
              (item.label === 'Accueil' && pathname === '/') ||
              ((item.label === 'Ma liste' || item.label === 'Profil') && pathname === '/profiles');

            return (
              <Link
                key={`bottom-nav-${item.label}`}
                href={item.href}
                className={`flex min-w-16 flex-col items-center gap-1 rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                  active ? 'text-[#f00816]' : 'text-[#99999f] hover:text-white'
                }`}
              >
                <Icon size={19} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
