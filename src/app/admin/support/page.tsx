import type { Metadata } from 'next';
import AdminSupport from '@/components/admin/AdminSupport';

export const metadata: Metadata = {
  title: 'Demandes d’aide — Administration CINEVERSE',
  robots: { index: false, follow: false },
};

// Login is required by the middleware; the staff check is made again by every /api/admin/support request.
export default function AdminSupportPage() {
  return <AdminSupport />;
}
