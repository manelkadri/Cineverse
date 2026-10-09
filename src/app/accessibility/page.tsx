import type { Metadata } from 'next';
import Link from 'next/link';
import { Bullets, LegalDocument, LegalSection, Todo } from '@/components/legal/LegalDocument';

export const metadata: Metadata = { title: 'Accessibilité (projet) — CINEVERSE', robots: { index: false, follow: false } };

export default function AccessibilityPage() {
  return (
    <LegalDocument title="Accessibilité" intro="Ce que CINEVERSE fait pour être utilisable par tous, et ce qui reste à améliorer.">
      <LegalSection id="etat" title="État de conformité">
        <p>CINEVERSE n’a pas fait l’objet d’un audit d’accessibilité. <strong className="text-white">Aucun niveau de conformité (RGAA, WCAG) n’est revendiqué.</strong> Cette page décrit les dispositions réellement mises en place et les limites connues.</p>
      </LegalSection>

      <LegalSection id="mesures" title="Ce qui est en place">
        <Bullets items={[
          'La langue de l’interface est déclarée (français) et chaque page a un titre.',
          'Le Centre d’aide, Mon compte, l’écran du code PIN et les formulaires sont utilisables au clavier ; les champs ont des étiquettes et les erreurs sont annoncées aux lecteurs d’écran.',
          'Les questions fréquentes sont un accordéon accessible (états annoncés, navigation par flèches, contenu replié inaccessible).',
          'Le code PIN se saisit dans un vrai champ de saisie : le clavier numérique natif des mobiles et la saisie assistée fonctionnent.',
          'Les indicateurs de focus sont visibles sur les éléments interactifs de ces pages.',
          'Les animations sont supprimées ou réduites si votre système demande de réduire les animations.',
          'Le Centre d’aide, Mon compte et l’écran du code PIN s’adaptent aux écrans de 320 à 1440 pixels de large sans défilement horizontal.',
          'Les affiches des cartes de titres ont un texte alternatif.',
        ]} />
      </LegalSection>

      <LegalSection id="limites" title="Limites connues">
        <Bullets items={[
          'Les contrastes du thème sombre n’ont pas été mesurés systématiquement.',
          'Le catalogue, les fiches de titres, le carrousel d’accueil et l’écran de chargement animé n’ont pas été audités avec un lecteur d’écran.',
          'Les bandes-annonces sont diffusées par un lecteur tiers (YouTube ou Vimeo) dont l’accessibilité ne dépend pas de CINEVERSE. Il n’y a pas de sous-titres ni d’audiodescription fournis par CINEVERSE.',
          'Les tests automatisés ont été réalisés avec un navigateur Chromium ; les autres navigateurs et technologies d’assistance n’ont pas été testés de façon systématique.',
        ]} />
      </LegalSection>

      <LegalSection id="contact" title="Signaler un problème d’accessibilité">
        <p>Si vous rencontrez un obstacle, décrivez-le avec le formulaire du <Link href="/help#contact" className="font-semibold text-white underline decoration-primary underline-offset-4">Centre d’aide</Link> (catégorie « Autre demande ») en précisant la page et la technologie d’assistance utilisée. <Todo>le propriétaire indique ici le délai de réponse qu’il peut réellement tenir, ainsi que la voie de recours à mentionner s’il y est tenu</Todo>.</p>
      </LegalSection>
    </LegalDocument>
  );
}
