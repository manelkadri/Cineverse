import React from 'react';
import Navbar from '@/components/Navbar';
import HeroCarousel from './components/HeroCarousel';
import HomeRows from './components/HomeRows';
import Footer from '@/components/Footer';
import ProfileGate from '@/components/ProfileGate';

export const dynamic = 'force-dynamic';

export default function HomePage() {
  return (
    <ProfileGate>
      <main className="min-h-screen bg-background">
        <Navbar />
        <HeroCarousel />
        <div className="relative z-10 -mt-16 pb-20 md:pb-4">
          <HomeRows />
        </div>
        <Footer />
      </main>
    </ProfileGate>
  );
}
