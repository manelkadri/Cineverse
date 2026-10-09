import type { Metadata } from 'next';
import AdminAnalytics from '@/components/admin/AdminAnalytics';

export const metadata: Metadata = { title: 'Statistiques — Support CINEVERSE', robots: { index: false, follow: false } };

export default function Page() {
  return <AdminAnalytics />;
}
