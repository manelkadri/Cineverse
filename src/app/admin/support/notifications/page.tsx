import type { Metadata } from 'next';
import AdminNotifications from '@/components/admin/AdminNotifications';

export const metadata: Metadata = { title: 'Notifications — Support CINEVERSE', robots: { index: false, follow: false } };

export default function NotificationsPage() {
  return <AdminNotifications />;
}
