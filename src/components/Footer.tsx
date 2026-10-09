import React from 'react';
import Link from 'next/link';
import CineverseLogo from '@/components/CineverseLogo';

// Every footer entry leads to a real page. Genre ids are the TMDB ids used by the catalogue filter.
const COLUMNS: { heading: string; links: { label: string; href: string }[] }[] = [
  { heading: 'Navigation', links: [
    { label: 'Accueil', href: '/' },
    { label: 'Films', href: '/films-series-catalog?type=movie' },
    { label: 'Séries', href: '/films-series-catalog?type=tv' },
    { label: 'Ma liste', href: '/my-list' },
  ] },
  { heading: 'Genres', links: [
    { label: 'Action', href: '/films-series-catalog?genre=28' },
    { label: 'Comédie', href: '/films-series-catalog?genre=35' },
    { label: 'Drame', href: '/films-series-catalog?genre=18' },
    { label: 'Science-fiction', href: '/films-series-catalog?genre=878' },
  ] },
  { heading: 'Aide', links: [
    { label: 'FAQ', href: '/help#faq' },
    { label: 'Contact', href: '/help#contact' },
    { label: 'Accessibilité', href: '/accessibility' },
    { label: 'Cookies', href: '/cookies' },
  ] },
  { heading: 'Légal', links: [
    { label: 'CGU', href: '/terms' },
    { label: 'Confidentialité', href: '/privacy' },
    { label: 'Mentions légales', href: '/legal-notice' },
  ] },
];

export default function Footer() {
  return (
    <footer className="bg-background-secondary border-t border-border mt-12 py-12 px-4 lg:px-8 xl:px-10 pb-24 md:pb-12">
      <div className="max-w-screen-2xl mx-auto">
        <div className="mb-8">
          <CineverseLogo className="text-[29px]" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
          {COLUMNS.map((col) => (
            <div key={`footer-col-${col.heading}`}>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">{col.heading}</h4>
              <ul className="space-y-2">
                {col.links.map((link) => (
                  <li key={`footer-link-${link.label}`}>
                    <Link href={link.href} className="text-sm text-muted-foreground hover:text-white transition-colors">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="border-t border-border pt-6 flex flex-col md:flex-row items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">© 2026 CINEVERSE. Tous droits réservés.</p>
          <p className="text-xs text-muted-foreground">Données cinéma et télévision fournies par TMDB.</p>
        </div>
      </div>
    </footer>
  );
}
