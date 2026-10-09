import type { Metadata } from 'next';
import AdminArticleEditor from '@/components/admin/AdminArticleEditor';

export const metadata: Metadata = { title: 'Modifier un article — Support CINEVERSE', robots: { index: false, follow: false } };

export default async function EditArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  return <AdminArticleEditor slug={(await params).slug} />;
}
