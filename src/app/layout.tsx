import React from 'react';
import type { Metadata, Viewport } from 'next';
import { Anton, Plus_Jakarta_Sans } from 'next/font/google';
import '../styles/tailwind.css';
import { ProfileProvider } from '@/context/ProfileContext';
import AuthProvider from '@/components/AuthProvider';
import CinematicTransitionProvider from '@/components/CinematicTransitionProvider';
import { NotificationProvider } from '@/context/NotificationContext';

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-plus-jakarta-sans',
  display: 'swap',
});

// Wordmark face for the CINEVERSE logo only (self-hosted by next/font, no render-blocking @import).
const anton = Anton({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-logo',
  display: 'swap',
});

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export const metadata: Metadata = {
  title: 'CINEVERSE — Films & Séries en Streaming Premium',
  description: 'Découvrez des milliers de films et séries en streaming sur CINEVERSE, la plateforme cinématographique premium.',
  icons: {
    icon: [{ url: '/favicon.ico', type: 'image/x-icon' }],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${plusJakartaSans.variable} ${anton.variable}`}>
      <body className={plusJakartaSans.className} style={{ '--font-sans': 'var(--font-plus-jakarta-sans)' } as React.CSSProperties}>
        <AuthProvider><ProfileProvider><NotificationProvider><CinematicTransitionProvider>{children}</CinematicTransitionProvider></NotificationProvider></ProfileProvider></AuthProvider>

        <script type="module" async src="https://static.rocket.new/rocket-web.js?_cfg=https%3A%2F%2Fcineverse8586back.builtwithrocket.new&_be=https%3A%2F%2Fappanalytics.rocket.new&_v=0.1.21" />
        <script type="module" defer src="https://static.rocket.new/rocket-shot.js?v=0.0.3" /></body>
    </html>
  );
}
