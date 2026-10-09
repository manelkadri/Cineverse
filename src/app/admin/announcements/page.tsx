import type { Metadata } from 'next';
import AdminAnnouncements from '@/components/admin/AdminAnnouncements';

export const metadata: Metadata = {
  title: 'Annonces — Administration CINEVERSE',
  robots: { index: false, follow: false },
};

// Login is required by the middleware; the staff check is made again by every /api/admin/announcements request.
export default function AdminAnnouncementsPage() {
  return <AdminAnnouncements />;
}
