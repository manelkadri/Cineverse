import type { Metadata } from 'next';
import Link from 'next/link';
import { Bullets, DataTable, LegalDocument, LegalSection, Todo } from '@/components/legal/LegalDocument';

export const metadata: Metadata = { title: 'Cookies (projet) — CINEVERSE', robots: { index: false, follow: false } };

export default function CookiesPage() {
  return (
    <LegalDocument title="Cookies" intro="Les cookies que CINEVERSE dépose dans votre navigateur, à quoi ils servent et comment les supprimer.">
      <LegalSection id="resume" title="En bref">
        <p>CINEVERSE dépose uniquement des cookies strictement nécessaires à la connexion et à la sécurité. Il n’utilise ni cookie publicitaire, ni cookie de suivi de ses propres pages, et n’enregistre rien dans le stockage local de votre navigateur.</p>
      </LegalSection>

      <LegalSection id="liste" title="Cookies déposés par CINEVERSE">
        <DataTable
          head={['Cookie', 'Rôle', 'Durée', 'Caractéristiques']}
          rows={[
            [<code key="s">next-auth.session-token</code>, 'Maintient votre connexion (identifiant de session signé).', '30 jours, ou jusqu’à la déconnexion', 'HttpOnly, SameSite=Lax, préfixe __Secure- et attribut Secure sur le site en https.'],
            [<code key="c">next-auth.csrf-token</code>, 'Protège le formulaire de connexion contre les requêtes frauduleuses.', 'Session du navigateur', 'HttpOnly, SameSite=Lax, préfixe __Host- en https.'],
            [<code key="u">next-auth.callback-url</code>, 'Se souvient de la page à rouvrir après la connexion.', 'Session du navigateur', 'HttpOnly, SameSite=Lax, préfixe __Secure- en https.'],
            [<code key="p">cv-unlock</code>, 'Atteste que le code PIN d’un profil a été saisi dans cette connexion.', '24 heures, ou jusqu’à la déconnexion', 'HttpOnly, SameSite=Lax, préfixe __Secure- en https. Contient une signature, jamais le code PIN.'],
          ]}
        />
        <p>Ces cookies sont indispensables : sans eux, la connexion et la protection des profils ne peuvent pas fonctionner. Ils ne nécessitent pas de consentement.</p>
      </LegalSection>

      <LegalSection id="tiers" title="Services tiers">
        <Bullets items={[
          'Affiches et images : chargées depuis les serveurs d’images de TMDB. Votre navigateur communique votre adresse réseau à TMDB pour les obtenir.',
          'Bandes-annonces : lorsque vous en ouvrez une, la vidéo est diffusée par YouTube (domaine sans cookies) ou Vimeo, qui peuvent enregistrer des données selon leurs propres règles.',
          <>Deux scripts de la plateforme de conception du site (static.rocket.new) sont chargés sur les pages. <Todo>vérifier s’ils déposent des cookies ou mesurent l’audience ; si oui, les lister ici et mettre en place le recueil du consentement, sinon les retirer avant la publication</Todo>.</>,
        ]} />
        <p><Todo>le propriétaire décide si un bandeau de consentement est nécessaire une fois ces points vérifiés : aucun bandeau n’existe actuellement</Todo>.</p>
      </LegalSection>

      <LegalSection id="gerer" title="Les gérer ou les supprimer">
        <p>Vous pouvez supprimer les cookies depuis les réglages de votre navigateur. Vous serez alors déconnecté et devrez ressaisir les codes PIN. Se déconnecter depuis le menu du profil, ou fermer toutes les sessions dans <Link href="/account" className="font-semibold text-white underline decoration-primary underline-offset-4">Mon compte</Link>, invalide aussi la session côté serveur.</p>
        <p>Pour en savoir plus sur vos données, consultez la <Link href="/privacy" className="font-semibold text-white underline decoration-primary underline-offset-4">politique de confidentialité</Link>.</p>
      </LegalSection>
    </LegalDocument>
  );
}
