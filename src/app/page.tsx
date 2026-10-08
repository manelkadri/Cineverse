import React from 'react';
import Navbar from '@/components/Navbar';
import HeroCarousel from './components/HeroCarousel';
import HomeRows from './components/HomeRows';
import Footer from '@/components/Footer';
import ProfileGate from '@/components/ProfileGate';
import { getHomeSections } from '@/lib/tmdb';
import type { HomeSections } from '@/lib/tmdb-types';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  let sections: HomeSections = { hero: [], trending: [], popularMovies: [], popularSeries: [], newReleases: [], topRated: [] };
  let error = false;
  try { sections = await getHomeSections(); } catch { error = true; }
  return (
    <ProfileGate>
      <main className="min-h-screen bg-background">
        <Navbar />
        <HeroCarousel items={sections.hero} error={error} />
        <div className="relative z-10 -mt-16 pb-20 md:pb-4">
          <HomeRows sections={sections} error={error} />
        </div>
        <Footer />
      </main>
    </ProfileGate>
  );
}
