import React from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import DetailContent from './components/DetailContent';
import ProfileGate from '@/components/ProfileGate';

export default function MovieDetailPage() {
  return (
    <ProfileGate>
      <main className="min-h-screen bg-background">
        <Navbar />
        <DetailContent />
        <Footer />
      </main>
    </ProfileGate>
  );
}
