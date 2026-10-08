'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Bell, Check, ChevronDown, CircleHelp, Home, ListVideo, LogOut, Menu, Pencil, Search, Settings, UserRound, X } from 'lucide-react';
import ProfileAvatar from './ProfileAvatar';
import { useProfiles } from '@/context/ProfileContext';

const navigation = [
  { label: 'Accueil', href: '/' },
  { label: 'Films', href: '/films-series-catalog?type=movie' },
  { label: 'Séries', href: '/films-series-catalog?type=tv' },
  { label: 'Ma liste', href: '/my-list' },
];

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { profiles, selectedProfile, selectProfile } = useProfiles();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
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
      if (!profileMenuRef.current?.contains(event.target as Node)) setProfileMenuOpen(false);
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
    if (label === 'Films') return pathname === '/films-series-catalog' && searchParams.get('type') !== 'tv';
    if (label === 'Séries') return pathname === '/films-series-catalog' && searchParams.get('type') === 'tv';
    if (label === 'Ma liste') return pathname === href;
    return false;
  };

  const switchProfile = (id: string) => {
    selectProfile(id);
    setProfileMenuOpen(false);
    router.push('/');
  };

  const exitProfile = () => {
    selectProfile(null);
    setProfileMenuOpen(false);
    router.push('/profiles');
  };

  return (
    <>
      <nav className={`fixed inset-x-0 top-0 z-50 border-t border-white/[0.08] transition-colors duration-300 nav-blur ${scrolled ? 'border-b border-white/10 bg-[#050608]/95 shadow-xl shadow-black/30' : 'bg-gradient-to-b from-black/95 via-black/70 to-black/10'}`} aria-label="Navigation principale">
        <div className="mx-auto max-w-screen-2xl px-5 sm:px-7 lg:px-10">
          <div className="flex h-[66px] items-center justify-between">
            <div className="flex min-w-0 items-center gap-9 lg:gap-12">
              <Link href="/" className="shrink-0 leading-none" aria-label="Cineverse - Accueil"><span className="font-display text-[21px] tracking-[0.015em]"><span className="text-[#f00816]">CINE</span><span className="text-[#f1f1f1]">VERSE</span></span></Link>
              <div className="hidden items-stretch gap-7 md:flex">
                {navigation.map((item) => {
                  const active = isActive(item.label, item.href);
                  return <Link key={item.label} href={item.href} aria-current={active ? 'page' : undefined} className={`relative flex h-[66px] items-center text-[14px] font-semibold transition-colors duration-200 after:absolute after:inset-x-0 after:bottom-[12px] after:h-[2px] after:origin-left after:rounded-full after:bg-[#f00816] after:transition-transform ${active ? 'text-[#f2f2f2] after:scale-x-100' : 'text-[#a9a9ad] after:scale-x-0 hover:text-white hover:after:scale-x-100'}`}>{item.label}</Link>;
                })}
              </div>
            </div>

            <div className="flex items-center gap-1 sm:gap-2">
              {searchOpen ? (
                <form onSubmit={(event) => { event.preventDefault(); const query = searchValue.trim(); if (query) { router.push(`/films-series-catalog?q=${encodeURIComponent(query)}`); setSearchOpen(false); } }} className="flex items-center gap-2 rounded-full border border-white/20 bg-black/65 px-3 py-2"><Search size={20} className="shrink-0 text-[#d6d6d8]" /><input autoFocus type="search" value={searchValue} onChange={(event) => setSearchValue(event.target.value)} placeholder="Rechercher..." className="w-28 bg-transparent text-sm text-white outline-none placeholder:text-[#85858b] sm:w-40" onKeyDown={(event) => { if (event.key === 'Escape') setSearchOpen(false); }} /></form>
              ) : (
                <button type="button" onClick={() => setSearchOpen(true)} className="grid size-10 place-items-center rounded-full text-[#d6d6d8] hover:bg-white/10 hover:text-white" aria-label="Rechercher"><Search size={24} /></button>
              )}
              <button type="button" className="relative grid size-10 place-items-center rounded-full text-[#d6d6d8] hover:bg-white/10 hover:text-white" aria-label="Notifications"><Bell size={22} /><span className="absolute right-[8px] top-[7px] size-1.5 rounded-full bg-primary ring-2 ring-black" /></button>

              <div ref={profileMenuRef} className="relative ml-1">
                <button type="button" onClick={() => setProfileMenuOpen((open) => !open)} className="group flex items-center gap-1" aria-label="Ouvrir le menu du profil" aria-haspopup="menu" aria-expanded={profileMenuOpen}>
                  {selectedProfile ? <ProfileAvatar avatar={selectedProfile.avatar} name={selectedProfile.name} className="size-9 rounded-full border-2 border-primary shadow-[0_0_0_2px_rgba(0,0,0,0.7)]" /> : <span className="grid size-9 place-items-center rounded-full border-2 border-primary bg-[#17191d]"><UserRound size={18} /></span>}
                  <ChevronDown size={14} className={`hidden text-[#8f8f94] transition-transform lg:block ${profileMenuOpen ? 'rotate-180 text-white' : ''}`} />
                </button>

                {profileMenuOpen && (
                  <div role="menu" className="absolute right-0 top-[49px] w-72 max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-xl border border-white/[0.12] bg-[#111418]/98 text-white shadow-[0_24px_80px_rgba(0,0,0,0.7)] nav-blur sm:w-80">
                    {selectedProfile && <div className="border-b border-white/[0.08] px-4 py-3"><p className="text-sm font-bold">{selectedProfile.name}</p><p className="mt-0.5 text-[11px] text-muted-foreground">{selectedProfile.isKids ? 'Profil enfant protégé' : 'Profil actif'}</p></div>}
                    <div className="p-2">
                      {profiles.map((profile) => {
                        const active = profile.id === selectedProfile?.id;
                        return <button key={profile.id} type="button" role="menuitem" onClick={() => switchProfile(profile.id)} className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-white/[0.07] ${active ? 'bg-white/[0.06]' : ''}`}><ProfileAvatar avatar={profile.avatar} name={profile.name} className="size-10 shrink-0 rounded-lg" /><span className="flex-1 text-sm font-semibold text-[#e1e1e4]">{profile.name}</span>{active && <span className="grid size-5 place-items-center rounded-full bg-primary"><Check size={12} strokeWidth={3} /></span>}</button>;
                      })}
                    </div>
                    <div className="border-t border-white/[0.08] p-2">
                      <Link href="/profiles" role="menuitem" onClick={() => setProfileMenuOpen(false)} className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-[#d7d7da] hover:bg-white/[0.07] hover:text-white"><Pencil size={19} className="text-[#aeb0b5]" />Gérer les profils</Link>
                      <button type="button" role="menuitem" className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-[#d7d7da] hover:bg-white/[0.07] hover:text-white"><Settings size={19} className="text-[#aeb0b5]" />Compte</button>
                      <button type="button" role="menuitem" className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-[#d7d7da] hover:bg-white/[0.07] hover:text-white"><CircleHelp size={19} className="text-[#aeb0b5]" />Centre d&apos;aide</button>
                    </div>
                    <div className="border-t border-white/[0.08] p-2"><button type="button" role="menuitem" onClick={exitProfile} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-bold text-[#e3e3e5] hover:bg-primary/15"><LogOut size={19} className="text-primary" />Quitter le profil</button></div>
                  </div>
                )}
              </div>

              <button type="button" className="ml-1 grid size-10 place-items-center rounded-full text-[#d6d6d8] hover:bg-white/10 hover:text-white md:hidden" onClick={() => setMobileOpen((open) => !open)} aria-label={mobileOpen ? 'Fermer le menu' : 'Ouvrir le menu'} aria-expanded={mobileOpen}>{mobileOpen ? <X size={23} /> : <Menu size={23} />}</button>
            </div>
          </div>
        </div>

        {mobileOpen && <div className="border-t border-white/10 bg-[#08090b]/98 px-5 py-2 md:hidden">{navigation.map((item) => { const active = isActive(item.label, item.href); return <Link key={item.label} href={item.href} className={`flex items-center border-l-2 px-4 py-3 text-sm font-semibold ${active ? 'border-primary bg-white/[0.05] text-white' : 'border-transparent text-[#a9a9ad]'}`} onClick={() => setMobileOpen(false)}>{item.label}</Link>; })}</div>}
      </nav>

      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-white/10 bg-[#08090b]/95 nav-blur md:hidden" aria-label="Navigation mobile">
        <div className="flex items-center justify-around px-2 py-2">
          {[{ label: 'Accueil', href: '/', icon: Home }, { label: 'Recherche', href: '/films-series-catalog', icon: Search }, { label: 'Ma liste', href: '/my-list', icon: ListVideo }, { label: 'Profil', href: '/profiles', icon: UserRound }].map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;
            return <Link key={item.label} href={item.href} className={`flex min-w-16 flex-col items-center gap-1 rounded-md px-3 py-1 text-xs font-medium ${active ? 'text-primary' : 'text-[#99999f]'}`}><Icon size={19} /><span>{item.label}</span></Link>;
          })}
        </div>
      </nav>
    </>
  );
}
