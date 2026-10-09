import type { Metadata } from 'next';
import HelpCenter from '@/components/help/HelpCenter';
import { loadPublishedKnowledgeBase } from '@/lib/kb-server';
import { loadAvailability, loadCategories } from '@/lib/support-server';

export const metadata: Metadata = {
  title: 'Centre d’aide — CINEVERSE',
  description: 'Trouvez rapidement des réponses à vos questions sur CINEVERSE : compte, profils et codes PIN, catalogue, Ma liste, sécurité et assistance technique.',
};

// Public page: it is deliberately not in the middleware matcher, so visitors who cannot log in can still read it. The content is
// the built-in Help Center plus the PUBLISHED knowledge-base edits (the built-in content alone if the
// database is unavailable). Generated statically and refreshed on demand when the administration publishes a change (see
// lib/help-revalidate.ts), with an hourly safety refresh.
export const revalidate = 3600;

export default async function HelpPage() {
  const [{ articles, faqs }, categories, availability] = await Promise.all([loadPublishedKnowledgeBase(), loadCategories(), loadAvailability()]);
  return (
    <HelpCenter
      articles={articles}
      faqs={faqs}
      categories={categories.filter((category) => category.enabled).map((category) => ({ id: category.id, label: category.label }))}
      availability={availability.enabled && availability.text ? availability.text : null}
    />
  );
}
