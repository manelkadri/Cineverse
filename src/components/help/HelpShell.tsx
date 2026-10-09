'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { ArrowLeft, ArrowUp } from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import CineverseLogo from '@/components/CineverseLogo';

/**
 * Frame shared by every Help Center page. The Help Center is public: a signed-in member gets the normal CINEVERSE
 * navbar, a visitor who cannot log in gets a minimal header with a way back to the login. Nothing here selects a profile,
 * asks for a PIN or starts the cinematic loader.
 */
export default function HelpShell({ children }: { children: React.ReactNode }) {
  const { status } = useSession();
  const [showTop, setShowTop] = useState(false);

  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 700);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <main className="min-h-screen bg-[#08090D] text-white">
      {status === 'authenticated' ? <Navbar /> : <PublicHeader />}
      {children}
      <Footer />
      {showTop && (
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })}
          aria-label="Revenir en haut de la page"
          className="fixed bottom-20 right-4 z-40 grid size-11 place-items-center rounded-full border border-white/15 bg-[#15171C]/95 text-white shadow-lg transition-colors hover:border-primary hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary md:bottom-6 md:right-6"
        >
          <ArrowUp size={18} aria-hidden="true" />
        </button>
      )}
    </main>
  );
}

function PublicHeader() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-white/[0.08] bg-[#08090D]/90 nav-blur">
      <div className="mx-auto flex h-[66px] max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/help" aria-label="CINEVERSE, Centre d’aide" className="leading-none"><CineverseLogo className="text-[27px]" /></Link>
        <nav aria-label="Navigation du Centre d’aide" className="flex items-center gap-2 sm:gap-3">
          <Link href="/" className="hidden items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-[#d7d7da] hover:bg-white/[0.07] hover:text-white sm:inline-flex"><ArrowLeft size={15} aria-hidden="true" />Retour à CINEVERSE</Link>
          <Link href="/login" className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-primary-hover">Se connecter</Link>
        </nav>
      </div>
    </header>
  );
}
