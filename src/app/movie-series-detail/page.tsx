import React from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import DetailContent from './components/DetailContent';
import ProfileGate from '@/components/ProfileGate';
import { getMediaDetails } from '@/lib/tmdb';
import type { MediaDetails } from '@/lib/tmdb-types';
import type { MediaType } from '@/lib/profile-types';

export default async function MovieDetailPage({ searchParams }: { searchParams: Promise<{ id?: string; type?: string }> }) {
  const params = await searchParams;
  const mediaType: MediaType | null = params.type === 'movie' || params.type === 'tv' ? params.type : null;
  const id = Number(params.id);
  let details: MediaDetails | null = null;
  let error = '';
  if (!mediaType || !Number.isInteger(id) || id <= 0) error = 'Ce lien ne contient pas un identifiant TMDB valide.';
  else {
    try { details = await getMediaDetails(mediaType, id); }
    catch { error = 'Les informations de ce titre sont momentanément indisponibles.'; }
  }
  return (
    <ProfileGate>
      <main className="min-h-screen bg-background">
        <Navbar />
        <DetailContent details={details} error={error} />
        <Footer />
      </main>
    </ProfileGate>
  );
}
