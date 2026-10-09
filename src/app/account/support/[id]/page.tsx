import type { Metadata } from 'next';
import { AccountSupportDetail } from '@/components/account/AccountSupport';

export const metadata: Metadata = { title: 'Ma demande d’aide — CINEVERSE', robots: { index: false, follow: false } };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  return <AccountSupportDetail id={(await params).id} />;
}
