import type { Metadata } from 'next';
import AdminOverview from '@/components/admin/AdminOverview';

export const metadata: Metadata = { title: 'Vue d’ensemble — Support CINEVERSE', robots: { index: false, follow: false } };

// The administrator check is made by app/admin/layout.tsx on the server; every number comes from /api/admin/support/overview.
export default function SupportOverviewPage() {
  return <AdminOverview />;
}
