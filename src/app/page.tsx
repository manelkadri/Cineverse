import React from 'react';
import Navbar from '@/components/Navbar';
import HeroCarousel from './components/HeroCarousel';
import HomeRows from './components/HomeRows';
import Footer from '@/components/Footer';
import ProfileGate from '@/components/ProfileGate';
import { getHomeSections } from '@/lib/tmdb';
import type { HomeSections } from '@/lib/tmdb-types';
import { currentProfileAccess, restrictItemsForProfile } from '@/lib/content-access';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  let sections: HomeSections = { hero: [], trending: [], popularMovies: [], popularSeries: [], newReleases: [], topRated: [] };
  let error = false;
  try {
    const [loaded, access] = await Promise.all([getHomeSections(), currentProfileAccess()]);
    sections = {
      hero: restrictItemsForProfile(loaded.hero, access),
      trending: restrictItemsForProfile(loaded.trending, access),
      popularMovies: restrictItemsForProfile(loaded.popularMovies, access),
      popularSeries: restrictItemsForProfile(loaded.popularSeries, access),
      newReleases: restrictItemsForProfile(loaded.newReleases, access),
      topRated: restrictItemsForProfile(loaded.topRated, access),
    };
  } catch { error = true; }
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
