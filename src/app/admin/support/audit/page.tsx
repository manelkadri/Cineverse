import type { Metadata } from 'next';
import AdminAudit from '@/components/admin/AdminAudit';

export const metadata: Metadata = { title: 'Journal d’activité — Support CINEVERSE', robots: { index: false, follow: false } };

export default function Page() {
  return <AdminAudit />;
}
