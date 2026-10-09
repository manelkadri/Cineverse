import type { Metadata } from 'next';
import Link from 'next/link';
import { Bullets, DataTable, LegalDocument, LegalSection, Todo } from '@/components/legal/LegalDocument';

// Draft: kept out of search engines until the owner has reviewed and published it.
export const metadata: Metadata = { title: 'Politique de confidentialité (projet) — CINEVERSE', robots: { index: false, follow: false } };

export default function PrivacyPage() {
  return (
    <LegalDocument title="Politique de confidentialité" intro="Quelles données CINEVERSE conserve, pourquoi, pendant combien de temps, et comment les contrôler.">
      <LegalSection id="responsable" title="1. Qui est responsable de vos données">
        <p>Responsable du traitement : <Todo>nom ou raison sociale du propriétaire, adresse postale, adresse e-mail de contact</Todo>.</p>
        <p>Pour toute question ou demande sur vos données, utilisez le formulaire du <Link href="/help#contact" className="font-semibold text-white underline decoration-primary underline-offset-4">Centre d’aide</Link>.</p>
      </LegalSection>

      <LegalSection id="donnees" title="2. Les données conservées">
        <DataTable
          head={['Donnée', 'Détail', 'Finalité']}
          rows={[
            ['Compte', 'Nom, adresse e-mail, mot de passe sous forme d’empreinte irréversible (bcrypt), date d’inscription.', 'Créer et sécuriser votre compte.'],
            ['Profils', 'Nom, avatar, mode enfant et classification, genres préférés, langue, codes PIN et code parental sous forme d’empreintes irréversibles.', 'Personnaliser le service et protéger chaque profil.'],
            ['Liste, favoris, historique', 'Identifiants TMDB des titres enregistrés, aimés ou regardés, position de reprise.', 'Fonctionnement de Ma liste, des favoris et des reprises.'],
            ['Sessions de connexion', 'Identifiant interne et date d’expiration de chaque connexion ouverte (aucun nom d’appareil, lieu ou adresse réseau).', 'Maintenir et révoquer vos connexions.'],
            ['Demandes d’aide', 'Adresse e-mail indiquée, sujet, catégorie, message, lien avec le compte si vous étiez connecté, empreintes chiffrées de l’adresse réseau et du message.', 'Répondre à votre demande ; limiter le spam et les doublons.'],
            ['Journal de sécurité', 'Empreintes chiffrées (adresse e-mail + adresse réseau) de chaque tentative de connexion, d’inscription ou de code PIN, avec l’heure.', 'Bloquer les essais répétés (15 minutes) ; nettoyé régulièrement.'],
          ]}
        />
        <p>Le mot de passe, les codes PIN et le code parental ne sont jamais stockés en clair et ne peuvent pas être retrouvés ; le support ne les demande jamais.</p>
      </LegalSection>

      <LegalSection id="base-legale" title="3. Fondement juridique">
        <p><Todo>indiquer le fondement retenu pour chaque finalité : exécution du service demandé (compte, profils, listes), intérêt légitime (sécurité, lutte contre le spam), et consentement le cas échéant</Todo>.</p>
      </LegalSection>

      <LegalSection id="destinataires" title="4. Qui peut accéder aux données, et services tiers">
        <Bullets items={[
          <>Seule l’équipe de support habilitée peut lire les demandes d’aide.</>,
          <>Hébergement et base de données : l’application utilise une base PostgreSQL hébergée par Supabase (serveurs situés dans l’Union européenne d’après la configuration actuelle) et sera exécutée chez <Todo>hébergeur de l’application, par exemple Vercel</Todo>.</>,
          <>TMDB (The Movie Database) fournit les fiches, affiches et bandes-annonces. Le serveur de CINEVERSE interroge TMDB sans transmettre vos données personnelles ; en revanche, votre navigateur charge les affiches directement depuis les serveurs d’images de TMDB, qui reçoivent donc votre adresse réseau.</>,
          <>Lorsque vous ouvrez une bande-annonce, votre navigateur contacte le service vidéo qui la diffuse (YouTube en mode sans cookies, ou Vimeo).</>,
          <>Les pages chargent deux scripts de la plateforme de conception du site (static.rocket.new). <Todo>le propriétaire doit vérifier leur finalité exacte (mesure d’audience ou outil de développement), les décrire ici ou les retirer avant la mise en ligne publique</Todo>.</>,
        ]} />
        <p>Aucune donnée n’est vendue et CINEVERSE n’affiche pas de publicité. <Todo>préciser les éventuels transferts hors Union européenne liés à TMDB, YouTube, Vimeo et à l’hébergeur</Todo>.</p>
      </LegalSection>

      <LegalSection id="conservation" title="5. Durées de conservation">
        <Bullets items={[
          'Compte, profils, listes, favoris et historique : jusqu’à la suppression du compte.',
          'Sessions de connexion : 30 jours au maximum, ou jusqu’à la déconnexion ou la révocation.',
          <>Demandes d’aide : jusqu’à leur suppression par l’équipe ou la suppression du compte auquel elles sont liées. <Todo>durée maximale de conservation souhaitée</Todo></>,
          'Journal de sécurité : conservé pour la durée de la fenêtre de limitation puis nettoyé régulièrement (objectif : 24 heures au plus).',
        ]} />
      </LegalSection>

      <LegalSection id="droits" title="6. Vos droits et comment les exercer">
        <Bullets items={[
          <><strong className="text-white">Accès et portabilité :</strong> « Télécharger mes données » dans <Link href="/account" className="font-semibold text-white underline decoration-primary underline-offset-4">Mon compte</Link> (fichier JSON sans mot de passe, codes PIN ni jetons).</>,
          <><strong className="text-white">Rectification :</strong> le nom se modifie dans Mon compte ; les profils dans « Gérer les profils ».</>,
          <><strong className="text-white">Suppression :</strong> « Supprimer mon compte » efface le compte, les profils, listes, favoris, historique, sessions et demandes d’aide liées.</>,
          <><strong className="text-white">Autres demandes</strong> (opposition, limitation, demande d’aide à effacer sans compte) : via le formulaire du Centre d’aide.</>,
        ]} />
        <p>Autorité de contrôle : <Todo>confirmer l’autorité compétente, par exemple la CNIL en France</Todo>.</p>
      </LegalSection>

      <LegalSection id="securite" title="7. Sécurité">
        <p>Les mots de passe et codes PIN sont protégés par des empreintes irréversibles (les codes PIN avec un secret serveur supplémentaire), les essais répétés sont bloqués temporairement, chaque profil est verrouillé tant que son code n’a pas été saisi, et les opérations sensibles redemandent votre mot de passe. Aucun système n’est infaillible : ne réutilisez pas ce mot de passe ailleurs.</p>
      </LegalSection>

      <LegalSection id="enfants" title="8. Profils enfants">
        <p>Un « profil enfant » est un mode de filtrage des contenus au sein d’un compte ; il ne s’agit pas d’un compte distinct. <Todo>indiquer l’âge minimal pour créer un compte et la règle applicable aux mineurs</Todo>.</p>
      </LegalSection>

      <LegalSection id="cookies" title="9. Cookies">
        <p>CINEVERSE n’utilise que des cookies nécessaires au fonctionnement. Le détail figure dans la <Link href="/cookies" className="font-semibold text-white underline decoration-primary underline-offset-4">page Cookies</Link>.</p>
      </LegalSection>
    </LegalDocument>
  );
}
