import type { Metadata } from 'next';
import AdminKnowledgeBase from '@/components/admin/AdminKnowledgeBase';

export const metadata: Metadata = { title: 'Base de connaissances — Support CINEVERSE', robots: { index: false, follow: false } };

export default function KnowledgeBasePage() {
  return <AdminKnowledgeBase />;
}
