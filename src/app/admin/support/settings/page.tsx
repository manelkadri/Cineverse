import type { Metadata } from 'next';
import AdminSettings from '@/components/admin/AdminSettings';

export const metadata: Metadata = { title: 'Paramètres — Support CINEVERSE', robots: { index: false, follow: false } };

export default function Page() {
  return <AdminSettings />;
}
