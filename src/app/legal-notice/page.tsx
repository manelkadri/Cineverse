import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalDocument, LegalSection, Todo } from '@/components/legal/LegalDocument';

export const metadata: Metadata = { title: 'Mentions légales (projet) — CINEVERSE', robots: { index: false, follow: false } };

// Every identity field below can only come from the site owner, so none is filled in here.
export default function LegalNoticePage() {
  return (
    <LegalDocument title="Mentions légales" intro="Qui édite et héberge CINEVERSE.">
      <LegalSection id="editeur" title="Éditeur du site">
        <p>Nom ou raison sociale : <Todo>à renseigner</Todo></p>
        <p>Adresse : <Todo>à renseigner</Todo></p>
        <p>Contact : <Todo>adresse e-mail ou formulaire de contact de l’éditeur</Todo> (en attendant, le formulaire du <Link href="/help#contact" className="font-semibold text-white underline decoration-primary underline-offset-4">Centre d’aide</Link>).</p>
        <p>Directeur de la publication : <Todo>à renseigner</Todo></p>
      </LegalSection>
      <LegalSection id="hebergeur" title="Hébergement">
        <p>Application : <Todo>nom, adresse et contact de l’hébergeur (par exemple Vercel)</Todo></p>
        <p>Base de données : Supabase <Todo>raison sociale et adresse à confirmer</Todo></p>
      </LegalSection>
      <LegalSection id="donnees" title="Données et contenus">
        <p>Les informations sur les films et séries proviennent de TMDB. <em>Ce produit utilise l’API TMDB mais n’est ni approuvé ni certifié par TMDB.</em> Voir aussi la <Link href="/privacy" className="font-semibold text-white underline decoration-primary underline-offset-4">politique de confidentialité</Link> et les <Link href="/terms" className="font-semibold text-white underline decoration-primary underline-offset-4">conditions d’utilisation</Link>.</p>
      </LegalSection>
    </LegalDocument>
  );
}
