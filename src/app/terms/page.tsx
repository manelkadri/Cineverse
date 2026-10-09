import type { Metadata } from 'next';
import Link from 'next/link';
import { Bullets, LegalDocument, LegalSection, Todo } from '@/components/legal/LegalDocument';

export const metadata: Metadata = { title: 'Conditions d’utilisation (projet) — CINEVERSE', robots: { index: false, follow: false } };

export default function TermsPage() {
  return (
    <LegalDocument title="Conditions d’utilisation" intro="Les règles d’utilisation du service CINEVERSE.">
      <LegalSection id="objet" title="1. Objet et éditeur">
        <p>Ces conditions encadrent l’utilisation de CINEVERSE. Éditeur : <Todo>nom ou raison sociale, adresse, contact</Todo> (voir aussi les <Link href="/legal-notice" className="font-semibold text-white underline decoration-primary underline-offset-4">mentions légales</Link>).</p>
      </LegalSection>

      <LegalSection id="service" title="2. Ce que propose le service">
        <Bullets items={[
          'Un catalogue de films et de séries (fiches, affiches, notes, titres similaires) alimenté par TMDB, avec des recommandations par profil.',
          'Des bandes-annonces, lorsque TMDB en fournit.',
          'Des comptes, des profils protégés par un code PIN, Ma liste, des favoris et un historique de visionnage.',
        ]} />
        <p><strong className="text-white">CINEVERSE ne permet pas de regarder les films et séries en entier</strong> : aucune source de streaming autorisée n’est connectée à ce jour. Si cela change, ces conditions seront mises à jour.</p>
      </LegalSection>

      <LegalSection id="compte" title="3. Compte, mot de passe et codes PIN">
        <Bullets items={[
          'Vous fournissez des informations exactes et vous gardez votre mot de passe et vos codes PIN confidentiels. Vous êtes responsable de l’activité réalisée avec votre compte.',
          'Chaque compte peut avoir jusqu’à 5 profils. Le mode enfant filtre les contenus selon une classification : c’est une aide, pas une garantie.',
          'Après plusieurs essais en échec, la connexion ou un profil est bloqué temporairement. Ce mécanisme ne peut pas être contourné.',
          <>Âge minimal et règle applicable aux mineurs : <Todo>à préciser</Todo>.</>,
        ]} />
      </LegalSection>

      <LegalSection id="usage" title="4. Utilisation acceptable">
        <p>Il est interdit de perturber le service, de tenter d’accéder aux comptes ou aux données d’autrui, de contourner les protections (limites d’essais, codes PIN), d’extraire le catalogue de façon automatisée ou massive, ou d’envoyer des demandes d’aide abusives ou contenant des secrets (mot de passe, code PIN, jeton).</p>
      </LegalSection>

      <LegalSection id="contenus" title="5. Contenus et données de tiers">
        <p>Les fiches, affiches et informations proviennent de TMDB. <em>Ce produit utilise l’API TMDB mais n’est ni approuvé ni certifié par TMDB.</em> Les affiches, bandes-annonces et œuvres appartiennent à leurs titulaires de droits ; leur présence sur CINEVERSE ne confère aucun droit sur elles.</p>
        <p>Propriété intellectuelle du site (marque, logo, interface, code) : <Todo>à préciser par le propriétaire</Todo>.</p>
      </LegalSection>

      <LegalSection id="disponibilite" title="6. Disponibilité et responsabilité">
        <p>Le service est fourni « en l’état » : il peut être indisponible, modifié ou interrompu, et les informations de TMDB peuvent être incomplètes ou inexactes. <Todo>clauses de limitation de responsabilité à rédiger ou valider par un juriste</Todo>.</p>
      </LegalSection>

      <LegalSection id="donnees" title="7. Données personnelles">
        <p>Le traitement de vos données est décrit dans la <Link href="/privacy" className="font-semibold text-white underline decoration-primary underline-offset-4">politique de confidentialité</Link> et la <Link href="/cookies" className="font-semibold text-white underline decoration-primary underline-offset-4">page Cookies</Link>.</p>
      </LegalSection>

      <LegalSection id="fin" title="8. Résiliation">
        <p>Vous pouvez supprimer votre compte à tout moment depuis <Link href="/account" className="font-semibold text-white underline decoration-primary underline-offset-4">Mon compte</Link> : la suppression est définitive. L’éditeur peut suspendre ou supprimer un compte en cas d’usage contraire à ces conditions.</p>
      </LegalSection>

      <LegalSection id="modifications" title="9. Modifications, droit applicable, contact">
        <p>Ces conditions peuvent évoluer ; la date de mise à jour figure en bas de page. Droit applicable et juridiction compétente : <Todo>à déterminer par le propriétaire</Todo>. Pour toute question : formulaire du <Link href="/help#contact" className="font-semibold text-white underline decoration-primary underline-offset-4">Centre d’aide</Link>.</p>
      </LegalSection>
    </LegalDocument>
  );
}
