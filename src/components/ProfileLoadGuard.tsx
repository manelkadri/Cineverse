'use client';

import React, { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { useProfiles } from '@/context/ProfileContext';

/**
 * A member with no (or an expired) session goes to the login page, remembering where they were going. The server's answer decides:
 * a database that cannot be reached is NOT a missing session, so it never redirects (and never touches the session).
 */
export function useLoginRedirect() {
  const router = useRouter();
  const pathname = usePathname();
  const { ready, loadState } = useProfiles();
  const leaving = ready && (loadState === 'unauthenticated' || loadState === 'expired');
  useEffect(() => {
    if (!leaving) return;
    const params = new URLSearchParams({ callbackUrl: pathname || '/' });
    if (loadState === 'expired') params.set('reason', 'expired');
    router.replace(`/login?${params}`);
  }, [leaving, loadState, pathname, router]);
  return leaving;
}

/** Shown when the profiles cannot be loaded for a technical reason: says so, offers a retry, and reassures that nothing was deleted. */
export function ProfileLoadError({ className = '' }: { className?: string }) {
  const { loadState, error, refreshProfiles } = useProfiles();
  const [busy, setBusy] = useState(false);
  const retry = async () => { setBusy(true); try { await refreshProfiles(); } finally { setBusy(false); } };
  const misconfigured = loadState === 'misconfigured';
  return (
    <div role="alert" data-testid="profiles-load-error" data-state={loadState} className={`mx-auto max-w-lg rounded-xl border border-red-500/25 bg-red-500/10 p-5 text-left text-sm text-red-100 ${className}`}>
      <p className="flex items-center gap-2 text-base font-bold"><AlertTriangle size={18} aria-hidden="true" />{misconfigured ? 'Configuration du serveur incomplète' : 'Connexion à la base de données impossible'}</p>
      <p className="mt-2 text-red-100/90">{error ?? 'Réessayez dans un instant.'}</p>
      {!misconfigured && <p className="mt-1 text-red-100/70">Vos profils et vos codes PIN n’ont pas été modifiés, et vous restez connecté.</p>}
      {!misconfigured && (
        <button type="button" onClick={retry} disabled={busy} data-testid="profiles-retry" className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 font-bold text-white hover:bg-primary-hover disabled:opacity-60">
          <RefreshCw size={15} className={busy ? 'animate-spin motion-reduce:animate-none' : ''} aria-hidden="true" />{busy ? 'Nouvelle tentative…' : 'Réessayer'}
        </button>
      )}
    </div>
  );
}
