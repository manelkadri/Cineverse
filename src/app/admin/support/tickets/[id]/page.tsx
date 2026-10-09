import type { Metadata } from 'next';
import AdminTicketDetail from '@/components/admin/AdminTicketDetail';

export const metadata: Metadata = { title: 'Demande d’aide — Support CINEVERSE', robots: { index: false, follow: false } };

export default async function TicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return <AdminTicketDetail id={(await params).id} />;
}
