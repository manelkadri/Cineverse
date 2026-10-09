'use client';
/* eslint-disable @typescript-eslint/no-explicit-any -- reads the JSON documented and tested in support-admin.integration.test.ts */

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Bell, CheckCheck, Megaphone } from 'lucide-react';
import { useNotifications } from '@/context/NotificationContext';
import { Card, EmptyBlock, ErrorBlock, LoadingBlock, PageHeader, adminFetch, ghostButton, relativeTime, useAdminData } from './ui';

export default function AdminNotifications() {
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const { data, error, loading, reload, setData } = useAdminData<any>(`/api/admin/support/notifications?filter=${filter}&limit=30`);
  const { refreshCount } = useNotifications();
  const [notice, setNotice] = useState<string | null>(null);
  const [more, setMore] = useState(false);
  useEffect(() => { setNotice(null); }, [filter]);

  const loadMore = async () => {
    if (!data?.nextCursor) return;
    setMore(true);
    const result = await adminFetch(`/api/admin/support/notifications?filter=${filter}&limit=30&cursor=${encodeURIComponent(data.nextCursor)}`);
    setMore(false);
    if (!result.ok) return setNotice(result.body.error ?? 'Chargement impossible.');
    setData((current: any) => current && { ...current, notifications: [...current.notifications, ...result.body.notifications], nextCursor: result.body.nextCursor, unreadCount: result.body.unreadCount });
  };

  const markAll = async () => {
    const result = await adminFetch('/api/admin/support/notifications/read-all', { method: 'POST' });
    if (!result.ok) return setNotice(result.body.error ?? 'Action impossible.');
    setNotice('Toutes les notifications sont marquées comme lues.');
    await reload();
    void refreshCount({ force: true });
  };

  const toggle = async (item: any) => {
    const result = await adminFetch(`/api/notifications/${encodeURIComponent(item.id)}`, { method: 'PATCH', json: { read: !item.read } });
    if (!result.ok) return setNotice(result.body.error ?? 'Action impossible.');
    setData((current: any) => current && { ...current, notifications: current.notifications.map((entry: any) => entry.id === item.id ? { ...entry, read: !item.read } : entry), unreadCount: Math.max(0, current.unreadCount + (item.read ? 1 : -1)) });
    void refreshCount({ force: true });
  };

  return (
    <>
      <PageHeader title="Notifications" description="Événements du support qui vous concernent : nouvelles demandes, réponses, assignations."
        actions={<><Link href="/admin/announcements" className={ghostButton}><Megaphone size={15} aria-hidden="true" />Annonces</Link><button type="button" onClick={markAll} disabled={!data?.unreadCount} className={ghostButton} data-testid="mark-all-read"><CheckCheck size={15} aria-hidden="true" />Tout marquer comme lu</button></>} />
      <div role="tablist" aria-label="Filtre" className="mb-4 flex gap-1">
        {(['all', 'unread'] as const).map((value) => (
          <button key={value} type="button" role="tab" aria-selected={filter === value} onClick={() => setFilter(value)} className={`rounded-full px-3.5 py-1.5 text-xs font-bold ${filter === value ? 'bg-primary text-white' : 'text-[#a9a9ae] hover:bg-white/[0.08]'}`}>
            {value === 'all' ? 'Toutes' : `Non lues${data ? ` (${data.unreadCount})` : ''}`}
          </button>
        ))}
      </div>
      {notice && <p role="status" className="mb-3 text-sm text-emerald-300">{notice}</p>}
      {error && <ErrorBlock message={error} onRetry={reload} />}
      {loading && !data && <LoadingBlock />}
      {data && (data.notifications.length === 0
        ? <EmptyBlock testId="notifications-empty">{filter === 'unread' ? 'Aucune notification non lue.' : 'Aucune notification pour le moment.'}</EmptyBlock>
        : (
          <Card>
            <ul className="divide-y divide-white/[0.06]" data-testid="admin-notifications" data-unread={data.unreadCount}>
              {data.notifications.map((item: any) => (
                <li key={item.id} data-notification={item.id} data-read={item.read ? 'true' : 'false'} className="flex items-start gap-3 py-3">
                  <Bell size={16} aria-hidden="true" className={`mt-1 shrink-0 ${item.read ? 'text-[#6f6f78]' : 'text-primary'}`} />
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm ${item.read ? 'font-medium text-[#b7b7bd]' : 'font-bold text-white'}`}>{item.href ? <Link href={item.href} className="hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">{item.title}</Link> : item.title}</p>
                    <p className="mt-0.5 break-words text-sm text-[#9a9aa3]">{item.message}</p>
                    <p className="mt-1 text-xs text-[#6f6f78]">{relativeTime(item.createdAt)}</p>
                  </div>
                  <button type="button" onClick={() => toggle(item)} className="shrink-0 text-xs font-semibold text-[#a9a9ae] underline-offset-4 hover:text-white hover:underline">{item.read ? 'Marquer non lue' : 'Marquer lue'}</button>
                </li>
              ))}
            </ul>
            {data.nextCursor && <div className="pt-3 text-center"><button type="button" onClick={loadMore} disabled={more} className={ghostButton} data-testid="load-more">{more ? 'Chargement…' : 'Voir plus'}</button></div>}
          </Card>
        ))}
    </>
  );
}
