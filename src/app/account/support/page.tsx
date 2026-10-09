import type { Metadata } from 'next';
import { AccountSupportList } from '@/components/account/AccountSupport';

export const metadata: Metadata = { title: 'Mes demandes d’aide — CINEVERSE', robots: { index: false, follow: false } };

export default function Page() {
  return <AccountSupportList />;
}
