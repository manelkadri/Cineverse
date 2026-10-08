import React from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import DetailContent from './components/DetailContent';

export default function MovieDetailPage() {
  return (
    <main className="min-h-screen bg-background">
      <Navbar />
      <DetailContent />
      <Footer />
    </main>
  );
}