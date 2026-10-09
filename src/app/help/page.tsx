import type { Metadata } from 'next';
import HelpCenter from '@/components/help/HelpCenter';

export const metadata: Metadata = {
  title: 'Centre d’aide — CINEVERSE',
  description: 'Trouvez rapidement des réponses à vos questions sur CINEVERSE : compte, profils et codes PIN, catalogue, Ma liste, sécurité et assistance technique.',
};

// Public page: it is deliberately not in the middleware matcher, so visitors who cannot log in can still read it.
export default function HelpPage() {
  return <HelpCenter />;
}
