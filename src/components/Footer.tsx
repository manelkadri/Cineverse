import React from 'react';
import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="bg-background-secondary border-t border-border mt-12 py-12 px-4 lg:px-8 xl:px-10 pb-24 md:pb-12">
      <div className="max-w-screen-2xl mx-auto">
        <div className="mb-8">
          <span className="font-display text-2xl tracking-widest">
            <span className="text-primary">CINE</span>
            <span className="text-white">VERSE</span>
          </span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
          {[
            { heading: 'Navigation', links: ['Accueil', 'Films', 'Séries', 'Ma liste'] },
            { heading: 'Genres', links: ['Action', 'Comédie', 'Drame', 'Science-fiction'] },
            { heading: 'Aide', links: ['FAQ', 'Contact', 'Accessibilité', 'Cookies'] },
            { heading: 'Légal', links: ['CGU', 'Confidentialité', 'Mentions légales', 'Presse'] },
          ]?.map((col) => (
            <div key={`footer-col-${col?.heading}`}>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">{col?.heading}</h4>
              <ul className="space-y-2">
                {col?.links?.map((link) => (
                  <li key={`footer-link-${link}`}>
                    <Link href="/" className="text-sm text-muted-foreground hover:text-white transition-colors">
                      {link}
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
