'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';

interface NotificationContextValue {
  /** Unread notifications of the signed-in account, as last reported by the database. */
  unreadCount: number;
  setUnreadCount: (count: number) => void;
  /** Re-reads the count unless it was read very recently. `force` skips that check. */
  refreshCount: (options?: { force?: boolean }) => Promise<void>;
  /** A bell calls this while it is on screen; the count is only kept fresh while at least one bell is mounted. */
  registerBell: () => () => void;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

const FRESH_MS = 30_000; // a count read less than 30 s ago is reused (navigating between pages does not refetch)
const FOCUS_MS = 60_000; // coming back to the tab refreshes only if the count is older than a minute

/**
 * Holds the red badge's number. There is deliberately no timer: the count is read when a bell appears and when the tab
 * becomes visible again, and the panel updates it after every action, so the page makes no background requests.
 */
export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { status } = useSession();
  const [unreadCount, setUnreadCount] = useState(0);
  const lastRead = useRef(0);
  const inFlight = useRef<Promise<void> | null>(null);
  const bells = useRef(0);

  const refreshCount = useCallback(async ({ force = false }: { force?: boolean } = {}) => {
    if (status !== 'authenticated') return;
    if (inFlight.current) return inFlight.current;
    if (!force && Date.now() - lastRead.current < FRESH_MS) return;
    inFlight.current = (async () => {
      try {
        const response = await fetch('/api/notifications/unread-count', { cache: 'no-store' });
        if (response.ok) {
          const body = await response.json();
          if (typeof body.unreadCount === 'number') { setUnreadCount(body.unreadCount); lastRead.current = Date.now(); }
        }
        // on any failure the badge keeps its last value; the panel reports the error when it is opened
      } catch { /* offline: keep the last value */ } finally { inFlight.current = null; }
    })();
    return inFlight.current;
  }, [status]);

  useEffect(() => {
    if (status === 'unauthenticated') { setUnreadCount(0); lastRead.current = 0; }
  }, [status]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && bells.current > 0 && Date.now() - lastRead.current > FOCUS_MS) void refreshCount({ force: true });
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [refreshCount]);

  const registerBell = useCallback(() => {
    bells.current += 1;
    return () => { bells.current = Math.max(0, bells.current - 1); };
  }, []);

  const value = useMemo(() => ({ unreadCount, setUnreadCount, refreshCount, registerBell }), [unreadCount, refreshCount, registerBell]);
  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) throw new Error('useNotifications must be used inside NotificationProvider');
  return context;
}
