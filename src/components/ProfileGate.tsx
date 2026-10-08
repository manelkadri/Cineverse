'use client';

import React, { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useProfiles } from '@/context/ProfileContext';

export default function ProfileGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { ready, selectedProfile } = useProfiles();

  useEffect(() => {
    if (ready && !selectedProfile && pathname !== '/profiles') router.replace('/profiles');
  }, [pathname, ready, router, selectedProfile]);

  if (!ready || !selectedProfile) {
    return <div className="min-h-screen bg-background" aria-busy="true" />;
  }
  return <>{children}</>;
}
