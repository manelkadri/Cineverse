import type { Metadata } from 'next';
import AdminArticleEditor from '@/components/admin/AdminArticleEditor';

export const metadata: Metadata = { title: 'Nouvel article — Support CINEVERSE', robots: { index: false, follow: false } };

export default function NewArticlePage() {
  return <AdminArticleEditor slug={null} />;
}
