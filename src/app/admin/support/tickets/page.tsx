import { Suspense } from 'react';
import type { Metadata } from 'next';
import AdminTickets from '@/components/admin/AdminTickets';
import { LoadingBlock } from '@/components/admin/ui';

export const metadata: Metadata = { title: 'Demandes d’aide — Support CINEVERSE', robots: { index: false, follow: false } };

export default function TicketsPage() {
  // the filters live in the address (so the overview can link to a filtered list), which needs a Suspense boundary
  return <Suspense fallback={<LoadingBlock />}><AdminTickets /></Suspense>;
}
