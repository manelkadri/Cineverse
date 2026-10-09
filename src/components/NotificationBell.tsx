'use client';

import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, BellOff, CheckCheck, Clapperboard, Circle, CircleDot, LifeBuoy, Loader2, Megaphone, ShieldCheck } from 'lucide-react';
import { useNotifications } from '@/context/NotificationContext';
import { CATEGORY_LABELS, formatRelativeTime, isSafeInternalPath, type NotificationCategory, type NotificationItem } from '@/lib/notification-rules';

type Filter = 'all' | 'unread';

const ICONS: Record<NotificationCategory, React.ComponentType<{ size?: number; className?: string }>> = {
  security: ShieldCheck,
  support: LifeBuoy,
  catalogue: Clapperboard,
  service: Megaphone,
};

async function call(path: string, method = 'GET', json?: unknown) {
  try {
    const response = await fetch(path, { method, headers: json === undefined ? undefined : { 'Content-Type': 'application/json' }, body: json === undefined ? undefined : JSON.stringify(json), cache: 'no-store' });
    return { ok: response.ok, status: response.status, body: await response.json().catch(() => ({})) };
  } catch {
    return { ok: false, status: 0, body: {} };
  }
}

/**
 * The navbar bell: a badge that exists only while something is unread, and a panel with the account's notifications.
 * Opening it never navigates, plays or loads anything else; choosing a notification goes to its (validated, internal)
 * destination with a normal client-side navigation, so neither the cinematic loader nor a profile PIN is involved.
 */
export default function NotificationBell() {
  const router = useRouter();
  const { unreadCount, setUnreadCount, refreshCount, registerBell } = useNotifications();
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const bellRef = useRef<HTMLButtonElement>(null);
  const tabRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const unregister = registerBell();
    void refreshCount();
    return unregister;
  }, [registerBell, refreshCount]);

  const load = useCallback(async (which: Filter) => {
    setLoading(true); setError(null);
    const result = await call(`/api/notifications?filter=${which}&limit=15`);
    setLoading(false);
    if (!result.ok) {
      setItems([]); setNextCursor(null);
      setError(result.status === 503 ? 'Les notifications ne sont pas encore activées sur ce serveur.' : 'Impossible de charger vos notifications.');
      return;
    }
    setItems(result.body.notifications as NotificationItem[]);
    setNextCursor(result.body.nextCursor ?? null);
    setUnreadCount(result.body.unreadCount as number);
  }, [setUnreadCount]);

  const close = useCallback((returnFocus: boolean) => {
    setLeaving(true);
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.setTimeout(() => { setOpen(false); setLeaving(false); }, reduce ? 0 : 130);
    if (returnFocus) bellRef.current?.focus();
  }, []);

  const toggle = () => {
    if (open && !leaving) return close(false);
    setOpen(true); setLeaving(false);
    void load(filter);
  };

  useEffect(() => {
    if (open && !leaving) tabRef.current?.focus({ preventScroll: true });
  }, [open, leaving]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent | TouchEvent) => { if (!rootRef.current?.contains(event.target as Node)) close(false); };
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.preventDefault(); close(true); } };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('touchstart', onPointer, { passive: true });
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onPointer); document.removeEventListener('touchstart', onPointer); document.removeEventListener('keydown', onKey); };
  }, [open, close]);

  const changeFilter = (next: Filter) => {
    if (next === filter) return;
    setFilter(next);
    void load(next);
  };

  const loadMore = async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    const result = await call(`/api/notifications?filter=${filter}&limit=15&cursor=${encodeURIComponent(nextCursor)}`);
    setLoadingMore(false);
    if (!result.ok) return setError('Impossible de charger la suite.');
    setItems((current) => [...current, ...(result.body.notifications as NotificationItem[]).filter((item) => !current.some((existing) => existing.id === item.id))]);
    setNextCursor(result.body.nextCursor ?? null);
    setUnreadCount(result.body.unreadCount as number);
  };

  const setRead = async (item: NotificationItem, read: boolean) => {
    if (item.read === read) return true;
    setError(null);
    const previous = items;
    setItems((current) => (filter === 'unread' && read ? current.filter((entry) => entry.id !== item.id) : current.map((entry) => (entry.id === item.id ? { ...entry, read } : entry))));
    setUnreadCount(Math.max(0, unreadCount + (read ? -1 : 1)));
    const result = await call(`/api/notifications/${encodeURIComponent(item.id)}`, 'PATCH', { read });
    if (!result.ok) {
      setItems(previous);
      setUnreadCount(unreadCount);
      setError('La mise à jour a échoué. Réessayez.');
      return false;
    }
    setUnreadCount(result.body.unreadCount as number);
    return true;
  };

  const markAll = async () => {
    if (busy || unreadCount === 0) return;
    setBusy(true); setError(null);
    const result = await call('/api/notifications/read-all', 'POST', {});
    setBusy(false);
    if (!result.ok) return setError('La mise à jour a échoué. Réessayez.');
    setItems((current) => (filter === 'unread' ? [] : current.map((entry) => ({ ...entry, read: true }))));
    setNextCursor(null);
    setUnreadCount(0);
  };

  const follow = (item: NotificationItem) => {
    if (!item.read) void setRead(item, true);
    if (item.href && isSafeInternalPath(item.href)) { close(false); router.push(item.href); }
  };

  const label = unreadCount > 0 ? `Notifications, ${unreadCount} non lue${unreadCount > 1 ? 's' : ''}` : 'Notifications';

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={bellRef}
        type="button"
        onClick={toggle}
        aria-label={label}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        data-testid="notification-bell"
        className="relative grid size-10 place-items-center rounded-full text-[#d6d6d8] transition-colors hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
      >
        <Bell size={22} aria-hidden="true" />
        {unreadCount > 0 && (
          <span data-testid="notification-badge" aria-hidden="true" className="absolute right-0 top-0 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-primary px-1 text-[10px] font-extrabold leading-none text-white ring-2 ring-black">{unreadCount > 9 ? '9+' : unreadCount}</span>
        )}
      </button>

      {open && (
        <div
          id={panelId}
          role="dialog"
          aria-label="Notifications"
          data-testid="notification-panel"
          className={`cv-notif-panel ${leaving ? 'cv-notif-panel--leaving' : ''} fixed inset-x-3 top-[70px] z-[60] flex max-h-[min(34rem,calc(100dvh-5.5rem))] flex-col overflow-hidden rounded-xl border border-white/[0.12] bg-[#111418] text-white shadow-[0_24px_80px_rgba(0,0,0,0.7)] nav-blur sm:absolute sm:inset-x-auto sm:right-0 sm:top-[49px] sm:w-[26rem]`}
        >
          <div className="flex items-center justify-between gap-2 border-b border-white/[0.08] px-4 py-3">
            <h2 className="text-base font-extrabold">Notifications</h2>
            <button type="button" onClick={markAll} disabled={busy || unreadCount === 0} className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold text-[#d7d7da] transition-colors hover:bg-white/[0.08] hover:text-white disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
              {busy ? <Loader2 size={13} className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <CheckCheck size={14} aria-hidden="true" />}Tout marquer comme lu
            </button>
          </div>

          <div role="tablist" aria-label="Filtrer les notifications" className="flex gap-1 border-b border-white/[0.08] px-3 py-2">
            {([['all', 'Toutes'], ['unread', 'Non lues']] as const).map(([id, text], index) => (
              <button
                key={id}
                ref={index === 0 ? tabRef : undefined}
                type="button"
                role="tab"
                id={`${panelId}-tab-${id}`}
                aria-selected={filter === id}
                aria-controls={`${panelId}-list`}
                data-filter={id}
                onClick={() => changeFilter(id)}
                onKeyDown={(event) => { if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') { event.preventDefault(); changeFilter(id === 'all' ? 'unread' : 'all'); document.getElementById(`${panelId}-tab-${id === 'all' ? 'unread' : 'all'}`)?.focus(); } }}
                className={`rounded-full px-3.5 py-1 text-xs font-bold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${filter === id ? 'bg-primary text-white' : 'text-[#a9a9ae] hover:bg-white/[0.08] hover:text-white'}`}
              >
                {text}{id === 'unread' && unreadCount > 0 ? ` (${unreadCount})` : ''}
              </button>
            ))}
          </div>

          <div id={`${panelId}-list`} role="tabpanel" aria-labelledby={`${panelId}-tab-${filter}`} aria-busy={loading} className="min-h-[7rem] flex-1 overflow-y-auto overscroll-contain">
            {loading && <div className="flex items-center justify-center gap-2 py-10 text-sm text-[#9a9aa3]" role="status"><Loader2 size={16} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />Chargement…</div>}
            {!loading && error && items.length === 0 && (
              <div role="alert" data-testid="notification-error" className="px-5 py-8 text-center text-sm text-red-100">
                <p>{error}</p>
                <button type="button" onClick={() => void load(filter)} className="mt-3 rounded-lg bg-primary px-4 py-2 text-xs font-bold text-white hover:bg-primary-hover">Réessayer</button>
              </div>
            )}
            {!loading && !error && items.length === 0 && (
              <div data-testid="notification-empty" className="flex flex-col items-center gap-3 px-5 py-10 text-center">
                <BellOff size={28} className="text-[#5f5f68]" aria-hidden="true" />
                <p className="text-sm text-[#a9a9ae]">Aucune notification pour le moment.</p>
              </div>
            )}
            {!loading && items.length > 0 && (
              <ul className="divide-y divide-white/[0.06]">
                {items.map((item) => {
                  const Icon = ICONS[item.category] ?? Megaphone;
                  return (
                    <li key={item.id} data-notification={item.id} data-unread={!item.read} className={`group relative flex items-start gap-1 ${item.read ? '' : 'bg-primary/[0.06]'}`}>
                      {!item.read && <span aria-hidden="true" className="absolute inset-y-0 left-0 w-[3px] bg-primary" />}
                      <button type="button" onClick={() => follow(item)} className="flex min-w-0 flex-1 items-start gap-3 py-3 pl-4 pr-1 text-left transition-colors hover:bg-white/[0.04] focus-visible:bg-white/[0.04] focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary">
                        <span className={`mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg ${item.read ? 'bg-white/[0.06] text-[#8f8f94]' : 'bg-primary/15 text-primary'}`}><Icon size={17} aria-hidden="true" /></span>
                        <span className="min-w-0 flex-1">
                          <span className={`block text-sm ${item.read ? 'font-semibold text-[#cfcfd3]' : 'font-extrabold text-white'}`}>{item.title}</span>
                          <span className={`mt-0.5 block text-[13px] leading-snug ${item.read ? 'text-[#8f8f94]' : 'text-[#c3c3c9]'}`}>{item.message}</span>
                          <span className="mt-1.5 flex items-center gap-2 text-[11px] text-[#7d7d86]"><span className="font-semibold uppercase tracking-wider">{CATEGORY_LABELS[item.category] ?? item.category}</span><span aria-hidden="true">·</span><time dateTime={item.createdAt} title={new Date(item.createdAt).toLocaleString('fr-FR')}>{formatRelativeTime(item.createdAt)}</time></span>
                        </span>
                        <span className="sr-only">{item.read ? 'Lue' : 'Non lue'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => void setRead(item, !item.read)}
                        aria-label={item.read ? `Marquer comme non lue : ${item.title}` : `Marquer comme lue : ${item.title}`}
                        title={item.read ? 'Marquer comme non lue' : 'Marquer comme lue'}
                        className="mr-2 mt-3 grid size-8 shrink-0 place-items-center rounded-full text-[#8f8f94] transition-colors hover:bg-white/[0.08] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                      >
                        {item.read ? <Circle size={14} aria-hidden="true" /> : <CircleDot size={14} className="text-primary" aria-hidden="true" />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            {!loading && items.length > 0 && error && <p role="alert" className="px-4 py-2 text-xs text-red-200">{error}</p>}
            {!loading && nextCursor && (
              <div className="border-t border-white/[0.06] p-2 text-center">
                <button type="button" onClick={loadMore} disabled={loadingMore} className="rounded-md px-3 py-1.5 text-xs font-semibold text-[#d7d7da] hover:bg-white/[0.08] hover:text-white disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">{loadingMore ? 'Chargement…' : 'Voir plus'}</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
