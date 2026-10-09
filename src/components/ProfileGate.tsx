'use client';

import React, { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useProfiles } from '@/context/ProfileContext';
import { ProfileLoadError, useLoginRedirect } from '@/components/ProfileLoadGuard';

export default function ProfileGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { ready, loadState, selectedProfile } = useProfiles();
  const leaving = useLoginRedirect();

  useEffect(() => {
    if (ready && loadState === 'ready' && !selectedProfile && pathname !== '/profiles') router.replace('/profiles');
  }, [pathname, ready, loadState, router, selectedProfile]);

  if (ready && !leaving && (loadState === 'unavailable' || loadState === 'misconfigured')) {
    return <main className="grid min-h-screen place-items-center bg-background px-4"><ProfileLoadError /></main>;
  }
  if (!ready || !selectedProfile) {
    return <div className="min-h-screen bg-background" aria-busy="true" />;
  }
  return <>{children}</>;
}
