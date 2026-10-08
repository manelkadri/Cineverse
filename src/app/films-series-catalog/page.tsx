import React from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import CatalogContent from './components/CatalogContent';

export default function CatalogPage() {
  return (
    <main className="min-h-screen bg-background">
      <Navbar />
      <div className="pt-20 pb-24 md:pb-4">
        <CatalogContent />
      </div>
      <Footer />
    </main>
  );
}