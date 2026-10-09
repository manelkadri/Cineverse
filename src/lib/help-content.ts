// Centre d'aide: the single, typed source for every category, article and FAQ entry.
// Every instruction below describes a feature that exists in CINEVERSE today (checked against the code). Where a
// feature does NOT exist (password reset by e-mail, full-length streaming, e-mail change, a support inbox) the text
// says so instead of inventing a button. tests/help.test.ts checks the structure and that every internal link is real.

export type CategoryId = 'compte' | 'profils' | 'films' | 'liste' | 'securite' | 'technique';

export interface HelpCategory {
  id: CategoryId;
  title: string;
  description: string;
  /** Lucide icon name, resolved by the UI (kept as a string so this file stays free of React). */
  icon: 'user-cog' | 'key-round' | 'clapperboard' | 'bookmark' | 'shield-check' | 'wrench';
}

export type HelpBlock =
  | { type: 'p'; text: string }
  | { type: 'h'; text: string }
  | { type: 'steps'; items: string[] }
  | { type: 'list'; items: string[] }
  | { type: 'note'; text: string }
  | { type: 'warning'; text: string };

export interface HelpLink { label: string; href: string }

export interface HelpArticle {
  slug: string;
  title: string;
  category: CategoryId;
  summary: string;
  body: HelpBlock[];
  links: HelpLink[];
  keywords: string[];
}

export interface HelpFaq {
  id: string;
  question: string;
  answer: string;
  category: CategoryId;
  /** The detailed article this answer comes from. */
  article: string;
  links?: HelpLink[];
  keywords?: string[];
}

export const HELP_CATEGORIES: HelpCategory[] = [
  { id: 'compte', title: 'Compte et connexion', description: 'Créer un compte, se connecter, changer le mot de passe.', icon: 'user-cog' },
  { id: 'profils', title: 'Profils et codes PIN', description: 'Créer un profil, choisir et protéger son code PIN.', icon: 'key-round' },
  { id: 'films', title: 'Films et séries', description: 'Parcourir le catalogue, chercher, voir les bandes-annonces.', icon: 'clapperboard' },
  { id: 'liste', title: 'Ma liste et favoris', description: 'Enregistrer des titres et les retrouver sur chaque profil.', icon: 'bookmark' },
  { id: 'securite', title: 'Confidentialité et sécurité', description: 'Protéger son compte, gérer ses données et ses sessions.', icon: 'shield-check' },
  { id: 'technique', title: 'Assistance technique', description: 'Images, bandes-annonces, lenteurs et erreurs courantes.', icon: 'wrench' },
];

const ACCOUNT: HelpLink = { label: 'Ouvrir Mon compte', href: '/account' };
const PROFILES: HelpLink = { label: 'Gérer les profils', href: '/profiles' };
const LOGIN: HelpLink = { label: 'Page de connexion', href: '/login' };
const CATALOG: HelpLink = { label: 'Parcourir le catalogue', href: '/films-series-catalog' };
const MYLIST: HelpLink = { label: 'Ouvrir Ma liste', href: '/my-list' };

export const HELP_ARTICLES: HelpArticle[] = [
  // ---------------------------------------------------------------- Compte et connexion
  {
    slug: 'creer-un-compte',
    title: 'Créer un compte CINEVERSE',
    category: 'compte',
    summary: 'Inscrivez-vous avec votre nom, une adresse e-mail et un mot de passe.',
    body: [
      { type: 'steps', items: [
        'Ouvrez la page de connexion et choisissez l’onglet « Inscription ».',
        'Saisissez votre nom (2 caractères minimum), votre adresse e-mail et un mot de passe.',
        'Cliquez sur « Créer le compte ». Vous êtes connecté automatiquement et arrivez sur l’écran des profils, où vous créez votre premier profil.',
      ] },
      { type: 'p', text: 'Le mot de passe doit contenir au moins 12 caractères, avec une minuscule, une majuscule et un chiffre.' },
      { type: 'note', text: 'Une adresse e-mail ne peut servir qu’à un seul compte. Si elle est déjà utilisée, l’inscription est refusée. Après plusieurs tentatives en échec, l’inscription est temporairement bloquée.' },
    ],
    links: [LOGIN, { label: 'Créer un profil', href: '/help/creer-un-profil' }],
    keywords: ['inscription', 'inscrire', 'nouveau compte', 'email', 'adresse', 'mot de passe', 'creer'],
  },
  {
    slug: 'se-connecter-et-se-deconnecter',
    title: 'Se connecter et se déconnecter',
    category: 'compte',
    summary: 'Connectez-vous avec votre e-mail et votre mot de passe ; déconnectez-vous depuis le menu du profil.',
    body: [
      { type: 'h', text: 'Se connecter' },
      { type: 'steps', items: ['Ouvrez la page de connexion, onglet « Connexion ».', 'Saisissez l’adresse e-mail et le mot de passe de votre compte.', 'Après la connexion, choisissez un profil et saisissez son code PIN.'] },
      { type: 'h', text: 'Se déconnecter' },
      { type: 'p', text: 'Cliquez sur l’avatar en haut à droite pour ouvrir le menu du profil, puis sur « Se déconnecter ». Votre connexion est fermée immédiatement sur cet appareil.' },
      { type: 'note', text: '« Quitter le profil » ne vous déconnecte pas : cela ramène seulement à l’écran de choix des profils.' },
      { type: 'p', text: 'Pour fermer vos connexions sur tous vos appareils d’un coup, utilisez « Se déconnecter partout » dans Mon compte.' },
    ],
    links: [LOGIN, ACCOUNT, { label: 'Difficultés de connexion', href: '/help/difficultes-de-connexion' }],
    keywords: ['connexion', 'login', 'deconnexion', 'logout', 'quitter', 'identifiants', 'session'],
  },
  {
    slug: 'changer-le-mot-de-passe',
    title: 'Changer le mot de passe du compte',
    category: 'compte',
    summary: 'Depuis Mon compte, avec votre mot de passe actuel.',
    body: [
      { type: 'steps', items: [
        'Connectez-vous, puis ouvrez Mon compte depuis le menu du profil (« Compte »).',
        'Dans « Mot de passe et sécurité », saisissez votre mot de passe actuel, le nouveau mot de passe et sa confirmation.',
        'Cliquez sur « Modifier le mot de passe ».',
      ] },
      { type: 'list', items: [
        'Le nouveau mot de passe doit contenir au moins 12 caractères, une minuscule, une majuscule et un chiffre, et différer de l’actuel.',
        'Vos autres sessions (autres appareils) sont fermées automatiquement ; la session en cours reste ouverte.',
        'Des essais répétés avec un mauvais mot de passe actuel bloquent temporairement l’opération.',
      ] },
    ],
    links: [ACCOUNT, { label: 'Protéger son compte', href: '/help/proteger-son-compte' }],
    keywords: ['mot de passe', 'password', 'modifier', 'changer', 'securite', 'session', 'actuel'],
  },
  {
    slug: 'mot-de-passe-oublie',
    title: 'J’ai oublié mon mot de passe : récupérer l’accès',
    category: 'compte',
    summary: 'Ce qui est possible aujourd’hui, et ce qui ne l’est pas encore.',
    body: [
      { type: 'warning', text: 'CINEVERSE ne propose pas encore de « mot de passe oublié » par e-mail. Aucun lien de réinitialisation n’est envoyé, et il n’existe pas de bouton de récupération sur la page de connexion.' },
      { type: 'h', text: 'Ce que vous pouvez faire' },
      { type: 'list', items: [
        'Vérifiez d’abord l’adresse e-mail saisie (c’est votre identifiant) et les majuscules du mot de passe.',
        'Si un appareil est encore connecté à votre compte, vous pouvez y consulter Mon compte, mais changer le mot de passe demande toujours le mot de passe actuel.',
        'Après 5 essais en échec pour une même adresse, la connexion est bloquée environ 15 minutes ; la bonne réponse n’est pas acceptée pendant ce délai.',
      ] },
      { type: 'p', text: 'Si le mot de passe est définitivement perdu, la récupération du compte n’est pas possible depuis l’application dans cette version. Vous pouvez créer un nouveau compte avec une autre adresse e-mail.' },
      { type: 'p', text: 'Vous pouvez aussi décrire votre situation avec le formulaire du Centre d’aide (catégorie « Compte et connexion »), sans jamais indiquer un mot de passe : la demande est enregistrée, mais aucun outil de réinitialisation automatique n’existe.' },
    ],
    links: [LOGIN, { label: 'Difficultés de connexion', href: '/help/difficultes-de-connexion' }, { label: 'Contacter le support', href: '/help#contact' }],
    keywords: ['oublie', 'perdu', 'recuperer', 'reinitialiser', 'reset', 'recuperation', 'acces', 'forgot', 'mot de passe'],
  },
  {
    slug: 'gerer-les-informations-du-compte',
    title: 'Gérer les informations du compte',
    category: 'compte',
    summary: 'Votre nom est modifiable ; l’adresse e-mail est votre identifiant et reste en lecture seule.',
    body: [
      { type: 'p', text: 'La page Mon compte réunit votre résumé (nom, adresse e-mail, date d’inscription, nombre de profils), le changement de nom, le mot de passe, vos profils, vos sessions et vos données.' },
      { type: 'steps', items: ['Ouvrez le menu du profil, puis « Compte ».', 'Dans « Informations personnelles », modifiez votre nom et cliquez sur « Enregistrer ».'] },
      { type: 'note', text: 'L’adresse e-mail ne peut pas être modifiée pour le moment : un changement d’adresse nécessitera une confirmation par e-mail qui n’est pas encore disponible.' },
    ],
    links: [ACCOUNT],
    keywords: ['nom', 'email', 'informations personnelles', 'profil du compte', 'modifier'],
  },

  {
    slug: 'notifications',
    title: 'Les notifications (la cloche)',
    category: 'compte',
    summary: 'Ce que signale la cloche en haut à droite, et comment régler ce que vous recevez.',
    body: [
      { type: 'p', text: 'La cloche de la barre de navigation rassemble les notifications de votre compte. Un badge rouge n’apparaît que lorsqu’il y a des notifications non lues, avec leur nombre.' },
      { type: 'h', text: 'Ce que vous pouvez recevoir' },
      { type: 'list', items: [
        'Sécurité : mot de passe modifié, code PIN créé ou modifié, profil verrouillé après plusieurs codes incorrects, sessions fermées. Elles ne contiennent jamais de mot de passe, de code PIN ou de jeton.',
        'Support : votre demande a été enregistrée, puis chaque changement de statut (en cours, résolue, fermée), uniquement si vous étiez connecté en l’envoyant.',
        'Catalogue et service : annonces publiées par l’équipe (nouveautés du catalogue, évolutions du service).',
      ] },
      { type: 'steps', items: [
        'Cliquez sur la cloche pour ouvrir le panneau ; « Toutes » et « Non lues » filtrent la liste.',
        'Cliquez sur une notification pour ouvrir la page concernée : elle est alors marquée comme lue.',
        'Le petit bouton à droite d’une notification la marque comme lue ou non lue ; « Tout marquer comme lu » vide le badge.',
        'Appuyez sur Échap ou cliquez ailleurs pour fermer le panneau.',
      ] },
      { type: 'h', text: 'Régler les notifications' },
      { type: 'p', text: 'Dans Mon compte, « Préférences du compte » permet de désactiver les annonces du catalogue et du service. Les notifications de sécurité et le suivi de vos demandes d’aide sont toujours activés et ne peuvent pas être désactivés.' },
      { type: 'note', text: 'CINEVERSE n’annonce pas automatiquement chaque sortie de film ou de série : aucune notification de nouveauté n’est créée sans annonce de l’équipe. Aucune notification n’est envoyée par e-mail.' },
    ],
    links: [ACCOUNT, { label: 'Protéger son compte', href: '/help/proteger-son-compte' }],
    keywords: ['notification', 'notifications', 'cloche', 'alerte', 'badge', 'non lue', 'marquer comme lu', 'annonce', 'preferences'],
  },

  // ---------------------------------------------------------------- Profils et codes PIN
  {
    slug: 'creer-un-profil',
    title: 'Créer un profil',
    category: 'profils',
    summary: 'Chaque compte peut avoir jusqu’à 5 profils, chacun avec son avatar, ses préférences et son code PIN.',
    body: [
      { type: 'steps', items: [
        'Ouvrez l’écran « Qui regarde ? » (menu du profil › « Gérer les profils », ou « Quitter le profil »).',
        'Cliquez sur « Ajouter ».',
        'Saisissez un nom, choisissez un avatar et, si vous le souhaitez, vos genres préférés.',
        'Choisissez un code PIN à 4 chiffres et confirmez-le.',
        'Cliquez sur « Enregistrer ».',
      ] },
      { type: 'p', text: 'Un profil « enfant » limite les titres à une classification maximale (7+ ou 10+) et demande en plus un code parental à 4 chiffres pour modifier ses réglages.' },
      { type: 'note', text: 'Le bouton « Ajouter » disparaît lorsque le compte a déjà 5 profils.' },
    ],
    links: [PROFILES, { label: 'Créer un code PIN', href: '/help/creer-un-code-pin' }, { label: 'Profil enfant', href: '/help/profil-enfant' }],
    keywords: ['profil', 'ajouter', 'avatar', 'nouveau', 'cinq profils', 'qui regarde'],
  },
  {
    slug: 'profil-enfant',
    title: 'Profils enfants et code parental',
    category: 'profils',
    summary: 'Un profil enfant filtre les contenus selon la classification choisie.',
    body: [
      { type: 'steps', items: ['Dans l’éditeur de profil, cochez « Profil enfant ».', 'Choisissez la classification maximale (7+ ou 10+).', 'Saisissez un code parental à 4 chiffres.'] },
      { type: 'list', items: [
        'Les titres au-dessus de la classification sont masqués dans le catalogue et les recommandations.',
        'Modifier la classification ou supprimer le profil demande le code parental, en plus du mot de passe du compte.',
        'Le code parental est distinct du code PIN qui ouvre le profil.',
      ] },
    ],
    links: [PROFILES],
    keywords: ['enfant', 'kids', 'parental', 'classification', 'controle parental', 'mineur'],
  },
  {
    slug: 'creer-un-code-pin',
    title: 'Créer un code PIN à 4 chiffres',
    category: 'profils',
    summary: 'Chaque profil est protégé par son propre code PIN.',
    body: [
      { type: 'p', text: 'Le code PIN se choisit à la création du profil, avec une confirmation. Il se compose de exactement 4 chiffres.' },
      { type: 'list', items: [
        'Les codes trop simples sont refusés : chiffres répétés (1111), suites (1234, 4321) et codes très courants (0000, 2580…).',
        'Le code n’est jamais enregistré en clair : seule une empreinte chiffrée est conservée.',
        'Un profil créé avant l’arrivée des codes PIN vous demande d’en créer un à sa première ouverture : saisissez 4 chiffres puis confirmez-les. Aucune donnée n’est perdue.',
      ] },
    ],
    links: [PROFILES, { label: 'Ouvrir un profil', href: '/help/ouvrir-un-profil-avec-son-code-pin' }],
    keywords: ['pin', 'code', '4 chiffres', 'creer', 'definir', 'securiser', 'protection'],
  },
  {
    slug: 'ouvrir-un-profil-avec-son-code-pin',
    title: 'Ouvrir un profil avec son code PIN',
    category: 'profils',
    summary: 'Choisissez un profil, saisissez ses 4 chiffres : la vérification est automatique.',
    body: [
      { type: 'steps', items: [
        'Sur « Qui regarde ? », cliquez sur le profil voulu.',
        'Saisissez les 4 chiffres du code : il n’y a ni bouton ni touche « Entrée », la vérification démarre dès le 4e chiffre.',
        'Si le code est correct, l’écran de chargement CINEVERSE s’affiche puis vous arrivez sur l’accueil.',
      ] },
      { type: 'list', items: [
        'Un code incorrect affiche « Code PIN incorrect », vide les cases et remet le curseur dans le champ ; il n’indique jamais quel chiffre est faux.',
        '« Retour aux profils » ramène à l’écran de choix sans ouvrir de profil.',
        'En cas de coupure réseau, un message distinct s’affiche : vérifiez votre connexion et ressaisissez le code.',
      ] },
    ],
    links: [PROFILES, { label: 'Erreurs de code PIN', href: '/help/erreurs-code-pin' }],
    keywords: ['ouvrir', 'deverrouiller', 'unlock', 'pin', 'saisir', 'chiffres', 'verification'],
  },
  {
    slug: 'changer-un-code-pin',
    title: 'Changer un code PIN en toute sécurité',
    category: 'profils',
    summary: 'Le changement exige le mot de passe du compte, pour prouver que vous en êtes le propriétaire.',
    body: [
      { type: 'steps', items: [
        'Sur l’écran « Qui regarde ? » (menu du profil › « Gérer les profils »), cliquez sur le bouton « Gérer les profils » en bas de l’écran, puis sur le profil à modifier.',
        'Saisissez le mot de passe de votre compte.',
        'Cliquez sur « Changer le code PIN », saisissez le nouveau code puis sa confirmation.',
        'Cliquez sur « Enregistrer ».',
      ] },
      { type: 'note', text: 'Le nouveau code doit respecter les mêmes règles que lors de la création (4 chiffres, pas de code trop simple). Un changement réussi efface aussi un éventuel blocage temporaire du profil.' },
    ],
    links: [PROFILES, ACCOUNT],
    keywords: ['changer', 'modifier', 'pin', 'mot de passe du compte', 'securite', 'nouveau code'],
  },
  {
    slug: 'code-pin-oublie',
    title: 'J’ai oublié le code PIN d’un profil',
    category: 'profils',
    summary: 'Vous pouvez en définir un nouveau en prouvant que vous êtes le propriétaire du compte.',
    body: [
      { type: 'p', text: 'Il n’est pas possible de retrouver un code PIN : il n’est pas stocké. En revanche, le propriétaire du compte peut en choisir un nouveau, sans perdre ni les listes, ni les favoris, ni l’historique du profil.' },
      { type: 'steps', items: [
        'Connectez-vous à votre compte, puis ouvrez « Gérer les profils » depuis l’écran « Qui regarde ? ».',
        'Choisissez le profil concerné : l’éditeur s’ouvre sans demander l’ancien code.',
        'Saisissez le mot de passe de votre compte (c’est la vérification du propriétaire).',
        'Cliquez sur « Changer le code PIN », saisissez un nouveau code et confirmez-le, puis « Enregistrer ».',
      ] },
      { type: 'note', text: 'Si vous avez aussi oublié le mot de passe du compte, aucune récupération n’est disponible dans cette version.' },
    ],
    links: [PROFILES, { label: 'Mot de passe oublié', href: '/help/mot-de-passe-oublie' }],
    keywords: ['oublie', 'perdu', 'pin', 'recuperer', 'reinitialiser', 'proprietaire', 'verification'],
  },
  {
    slug: 'blocage-temporaire-du-code-pin',
    title: 'Comprendre le blocage temporaire du code PIN',
    category: 'profils',
    summary: 'Après 5 erreurs, le profil est verrouillé un moment pour empêcher de deviner le code.',
    body: [
      { type: 'list', items: [
        '5 codes incorrects sur un même profil en 15 minutes verrouillent ce profil. Le message « Trop de tentatives. Réessayez dans … minutes. » indique le temps restant.',
        '20 erreurs sur l’ensemble des profils d’un compte verrouillent temporairement tous les profils.',
        'Pendant le blocage, même le bon code est refusé. Les autres profils non verrouillés restent utilisables.',
        'Le blocage se lève tout seul à la fin du délai. Un nouveau code défini avec le mot de passe du compte l’efface aussi.',
      ] },
      { type: 'p', text: 'Un code correct remet à zéro les erreurs précédentes du profil.' },
    ],
    links: [{ label: 'Code PIN oublié', href: '/help/code-pin-oublie' }, { label: 'Erreurs de code PIN', href: '/help/erreurs-code-pin' }],
    keywords: ['blocage', 'verrouille', 'tentatives', 'trop de tentatives', 'bloque', 'attendre', 'lockout', 'pin'],
  },
  {
    slug: 'changer-de-profil',
    title: 'Changer de profil',
    category: 'profils',
    summary: 'Depuis le menu du profil ; le code PIN du nouveau profil est toujours demandé.',
    body: [
      { type: 'steps', items: [
        'Cliquez sur l’avatar en haut à droite pour ouvrir le menu.',
        'Cliquez sur le profil voulu : l’écran de code PIN de ce profil s’ouvre.',
        'Saisissez son code pour continuer.',
      ] },
      { type: 'p', text: 'Un seul profil est ouvert à la fois par connexion. Les données d’un profil (liste, favoris, historique) ne sont jamais visibles depuis un autre profil. « Quitter le profil » referme le profil en cours.' },
    ],
    links: [PROFILES],
    keywords: ['changer', 'basculer', 'switch', 'autre profil', 'menu', 'quitter le profil'],
  },

  // ---------------------------------------------------------------- Films et séries
  {
    slug: 'parcourir-le-catalogue',
    title: 'Parcourir le catalogue de films et de séries',
    category: 'films',
    summary: 'L’accueil, Films et Séries : des sélections issues de TMDB.',
    body: [
      { type: 'p', text: 'L’accueil propose des rangées de titres et des recommandations pour le profil ouvert. Les entrées « Films » et « Séries » de la barre de navigation ouvrent le catalogue complet.' },
      { type: 'list', items: [
        'Les onglets « Populaires », « Tendances », « Nouveautés » et « Mieux notés » changent la sélection affichée.',
        'Un profil enfant ne voit que les titres adaptés à sa classification.',
        'Les fiches, affiches et notes proviennent de TMDB (The Movie Database).',
      ] },
    ],
    links: [CATALOG, { label: 'Rechercher et filtrer', href: '/help/rechercher-et-filtrer' }],
    keywords: ['catalogue', 'parcourir', 'films', 'series', 'accueil', 'populaires', 'tendances', 'nouveautes', 'tmdb'],
  },
  {
    slug: 'rechercher-et-filtrer',
    title: 'Rechercher et filtrer les contenus',
    category: 'films',
    summary: 'La loupe de la barre de navigation et les filtres du catalogue.',
    body: [
      { type: 'steps', items: ['Cliquez sur la loupe en haut de l’écran, saisissez un titre et validez.', 'Les résultats s’affichent dans le catalogue.'] },
      { type: 'p', text: 'Dans le catalogue, vous pouvez filtrer par genre, par année et par note, et trier par popularité ou par note. Les onglets de sélection (Populaires, Tendances…) sont désactivés pendant une recherche.' },
    ],
    links: [CATALOG],
    keywords: ['recherche', 'chercher', 'filtrer', 'genre', 'annee', 'note', 'trier', 'titre'],
  },
  {
    slug: 'fiche-detail-et-titres-similaires',
    title: 'Consulter une fiche et les titres similaires',
    category: 'films',
    summary: 'Cliquez sur une affiche pour voir les détails et des suggestions.',
    body: [
      { type: 'p', text: 'Un clic sur une affiche ouvre la fiche du titre : informations, note, bande-annonce lorsqu’elle existe, bouton « Ma liste » et rangée « Similaires » pour continuer à explorer.' },
    ],
    links: [CATALOG],
    keywords: ['fiche', 'details', 'detail', 'similaires', 'recommandations', 'synopsis', 'affiche'],
  },
  {
    slug: 'regarder-une-bande-annonce',
    title: 'Regarder une bande-annonce',
    category: 'films',
    summary: 'Le bouton « Bande-annonce » apparaît sur la fiche lorsqu’une vidéo est disponible.',
    body: [
      { type: 'steps', items: ['Ouvrez la fiche d’un film ou d’une série.', 'Cliquez sur « Bande-annonce » : la vidéo s’ouvre dans une fenêtre.', 'Fermez la fenêtre avec « Fermer » pour revenir à la fiche.'] },
      { type: 'note', text: 'Si le bouton est absent, aucune bande-annonce n’est disponible pour ce titre dans la base TMDB.' },
    ],
    links: [CATALOG, { label: 'Problème de bande-annonce', href: '/help/probleme-bande-annonce' }],
    keywords: ['bande annonce', 'trailer', 'video', 'teaser', 'youtube'],
  },
  {
    slug: 'disponibilite-des-contenus',
    title: 'Disponibilité des contenus : ce que CINEVERSE propose',
    category: 'films',
    summary: 'CINEVERSE est un catalogue : la lecture complète des films et séries n’est pas disponible.',
    body: [
      { type: 'warning', text: 'CINEVERSE ne dispose actuellement d’aucune source de streaming autorisée. Le bouton « Regarder » affiche donc un message « Lecture complète indisponible », et les films et séries ne peuvent pas être visionnés en entier.' },
      { type: 'list', items: [
        'Vous pouvez consulter les fiches, les notes et les titres similaires.',
        'Vous pouvez regarder les bandes-annonces lorsqu’elles existent.',
        'Vous pouvez organiser vos envies avec « Ma liste » et vos favoris.',
      ] },
    ],
    links: [CATALOG, MYLIST],
    keywords: ['disponibilite', 'streaming', 'regarder', 'lecture', 'film complet', 'visionner', 'indisponible', 'lecture complete'],
  },

  // ---------------------------------------------------------------- Ma liste et favoris
  {
    slug: 'ajouter-a-ma-liste',
    title: 'Ajouter un film ou une série à Ma liste',
    category: 'liste',
    summary: 'Depuis la fiche du titre ou depuis sa carte.',
    body: [
      { type: 'steps', items: ['Ouvrez la fiche d’un titre.', 'Cliquez sur « Ma liste » : le bouton devient « Dans ma liste ».', 'Le titre apparaît dans Ma liste, rubrique « Titres enregistrés ».'] },
      { type: 'p', text: 'Sur les cartes du catalogue, un bouton « + » (Ma liste) et un cœur (favori) permettent la même chose ; ils agissent sur le profil ouvert.' },
    ],
    links: [MYLIST],
    keywords: ['ajouter', 'ma liste', 'watchlist', 'enregistrer', 'plus tard', 'sauvegarder'],
  },
  {
    slug: 'retirer-de-ma-liste',
    title: 'Retirer un titre de Ma liste',
    category: 'liste',
    summary: 'Cliquez à nouveau sur le même bouton.',
    body: [
      { type: 'p', text: 'Sur la fiche, cliquez sur « Dans ma liste » pour retirer le titre. Sur une carte, cliquez de nouveau sur le bouton coché. Le titre disparaît aussitôt de Ma liste.' },
      { type: 'p', text: 'Pour retirer un favori, cliquez à nouveau sur le cœur.' },
    ],
    links: [MYLIST],
    keywords: ['retirer', 'supprimer', 'enlever', 'ma liste', 'favori'],
  },
  {
    slug: 'favoris-par-profil',
    title: 'Les listes et favoris sont propres à chaque profil',
    category: 'liste',
    summary: 'Chaque profil a sa liste, ses favoris et son historique, protégés par son code PIN.',
    body: [
      { type: 'p', text: 'Ma liste, les favoris et l’historique appartiennent au profil, pas au compte. Deux profils d’un même compte ne partagent rien, et un profil verrouillé ne montre aucune de ses données tant que son code PIN n’a pas été saisi.' },
      { type: 'note', text: 'Pour voir la liste d’un autre profil, changez de profil et saisissez son code PIN.' },
    ],
    links: [MYLIST, { label: 'Changer de profil', href: '/help/changer-de-profil' }],
    keywords: ['favoris', 'profil', 'liste', 'historique', 'separe', 'partage', 'confidentialite'],
  },
  {
    slug: 'retrouver-ma-liste-apres-reconnexion',
    title: 'Retrouver mes contenus après une reconnexion',
    category: 'liste',
    summary: 'Vos listes sont enregistrées dans la base de données, pas dans le navigateur.',
    body: [
      { type: 'steps', items: ['Connectez-vous avec votre compte.', 'Ouvrez le profil concerné avec son code PIN.', 'Ouvrez Ma liste : vos titres, favoris et reprises de lecture sont là.'] },
      { type: 'p', text: 'Comme tout est enregistré côté serveur, vous retrouvez les mêmes contenus sur un autre appareil ou un autre navigateur.' },
      { type: 'note', text: 'Si votre liste semble vide, vérifiez que vous avez ouvert le bon profil.' },
    ],
    links: [MYLIST, LOGIN],
    keywords: ['retrouver', 'reconnexion', 'perdu', 'disparu', 'vide', 'sauvegarde', 'autre appareil'],
  },

  // ---------------------------------------------------------------- Confidentialité et sécurité
  {
    slug: 'proteger-son-compte',
    title: 'Protéger son compte',
    category: 'securite',
    summary: 'Quelques réflexes simples pour garder le contrôle de votre compte.',
    body: [
      { type: 'list', items: [
        'Choisissez un mot de passe long et unique, que vous n’utilisez nulle part ailleurs.',
        'Donnez un code PIN différent et non évident à chaque profil.',
        'Ne communiquez jamais votre mot de passe ou un code PIN : CINEVERSE ne vous les demandera jamais, ni par message, ni dans un formulaire d’aide.',
        'Déconnectez-vous des appareils partagés, ou utilisez « Se déconnecter partout » dans Mon compte.',
        'Surveillez les sessions ouvertes dans Mon compte et fermez celles que vous ne reconnaissez pas.',
      ] },
    ],
    links: [ACCOUNT, { label: 'Gérer les sessions', href: '/help/gerer-les-sessions-actives' }],
    keywords: ['proteger', 'securite', 'mot de passe fort', 'pirate', 'piratage', 'compte', 'securiser'],
  },
  {
    slug: 'gerer-les-donnees-du-compte',
    title: 'Gérer les données de votre compte',
    category: 'securite',
    summary: 'Consultez ce qui est conservé et téléchargez vos données.',
    body: [
      { type: 'p', text: 'CINEVERSE conserve votre nom, votre adresse e-mail, une version chiffrée de votre mot de passe, vos profils (nom, avatar, préférences, codes PIN chiffrés), leurs listes, favoris et historique de visionnage, ainsi que vos sessions de connexion.' },
      { type: 'steps', items: ['Ouvrez Mon compte › « Confidentialité et données ».', 'Cliquez sur « Télécharger mes données » et saisissez votre mot de passe.', 'Un fichier JSON est téléchargé ; il ne contient ni mot de passe, ni codes PIN, ni jetons de session.'] },
    ],
    links: [ACCOUNT],
    keywords: ['donnees', 'telecharger', 'export', 'rgpd', 'personnelles', 'vie privee', 'json'],
  },
  {
    slug: 'confidentialite-des-profils',
    title: 'La confidentialité des profils',
    category: 'securite',
    summary: 'Un code PIN protège chaque profil, même sur un appareil déjà connecté.',
    body: [
      { type: 'list', items: [
        'Un profil ne s’ouvre qu’avec son code PIN, vérifié par le serveur.',
        'Tant qu’un profil est verrouillé, sa liste, ses favoris, son historique et ses préférences ne sont pas chargés.',
        'L’ouverture d’un profil est liée à votre connexion : elle ne se transmet pas à un autre appareil et disparaît à la déconnexion.',
        'Modifier ou supprimer un profil demande le mot de passe du compte.',
      ] },
    ],
    links: [PROFILES, { label: 'Changer de profil', href: '/help/changer-de-profil' }],
    keywords: ['confidentialite', 'prive', 'profil', 'pin', 'verrouille', 'donnees du profil'],
  },
  {
    slug: 'gerer-les-sessions-actives',
    title: 'Gérer les sessions actives',
    category: 'securite',
    summary: 'Voyez vos connexions ouvertes et fermez-les à distance.',
    body: [
      { type: 'steps', items: [
        'Ouvrez Mon compte › « Appareils et sessions ».',
        'La session en cours est marquée « Cette session » ; les autres sont listées avec leur date d’expiration.',
        'Cliquez sur « Fermer » pour une session, « Fermer les autres sessions » ou « Se déconnecter partout ».',
      ] },
      { type: 'note', text: 'CINEVERSE n’enregistre ni le nom de l’appareil, ni le lieu, ni la dernière activité : seule la date d’expiration est connue.' },
    ],
    links: [ACCOUNT],
    keywords: ['session', 'appareils', 'deconnecter partout', 'fermer', 'connexions', 'revoquer'],
  },
  {
    slug: 'supprimer-son-compte',
    title: 'Supprimer son compte',
    category: 'securite',
    summary: 'Une suppression définitive, protégée par votre mot de passe et une confirmation.',
    body: [
      { type: 'warning', text: 'La suppression est définitive : le compte, tous les profils, les listes, favoris, l’historique et les sessions sont effacés, et rien ne peut être récupéré.' },
      { type: 'steps', items: [
        'Ouvrez Mon compte › « Confidentialité et données » › « Supprimer mon compte ».',
        'Lisez l’avertissement, saisissez votre mot de passe, puis tapez le mot SUPPRIMER.',
        'Cliquez sur « Supprimer définitivement ». Vous êtes déconnecté et redirigé vers la connexion.',
      ] },
      { type: 'p', text: 'Pensez à télécharger vos données avant de supprimer si vous souhaitez en garder une copie.' },
    ],
    links: [ACCOUNT, { label: 'Gérer les données du compte', href: '/help/gerer-les-donnees-du-compte' }],
    keywords: ['supprimer', 'suppression', 'effacer', 'fermer le compte', 'delete', 'definitif'],
  },

  // ---------------------------------------------------------------- Assistance technique
  {
    slug: 'images-qui-ne-chargent-pas',
    title: 'Les images ne s’affichent pas',
    category: 'technique',
    summary: 'Les affiches viennent du service TMDB : quelques vérifications suffisent le plus souvent.',
    body: [
      { type: 'steps', items: [
        'Rechargez la page (Ctrl + R, ou Cmd + R sur Mac).',
        'Vérifiez votre connexion Internet ; les affiches sont chargées depuis le serveur d’images de TMDB.',
        'Désactivez temporairement un bloqueur de contenu ou un VPN qui pourrait bloquer ce service.',
        'Si le problème persiste, réessayez un peu plus tard.',
      ] },
      { type: 'note', text: 'Quand une affiche est introuvable ou lente à répondre, CINEVERSE affiche un visuel de remplacement plutôt qu’une image cassée.' },
    ],
    links: [{ label: 'Pages lentes', href: '/help/pages-lentes' }, { label: 'Signaler un problème', href: '/help/signaler-un-probleme' }],
    keywords: ['images', 'affiches', 'ne chargent pas', 'vide', 'cassees', 'posters', 'tmdb', 'visuel'],
  },
  {
    slug: 'probleme-bande-annonce',
    title: 'Une bande-annonce ne se lance pas',
    category: 'technique',
    summary: 'Les bandes-annonces sont lues depuis un service vidéo externe.',
    body: [
      { type: 'steps', items: [
        'Vérifiez votre connexion Internet.',
        'Fermez la fenêtre de la bande-annonce puis rouvrez-la.',
        'Désactivez un bloqueur de publicités ou de contenu pour cette page.',
        'Rechargez la page et réessayez.',
      ] },
      { type: 'note', text: 'Certaines vidéos peuvent être retirées ou restreintes par leur éditeur : la bande-annonce affichée dépend de ce que fournit TMDB. Si le bouton « Bande-annonce » est absent, aucune vidéo n’est disponible pour ce titre.' },
    ],
    links: [{ label: 'Regarder une bande-annonce', href: '/help/regarder-une-bande-annonce' }],
    keywords: ['bande annonce', 'trailer', 'ne se lance pas', 'video', 'lecture', 'erreur', 'noir'],
  },
  {
    slug: 'pages-lentes',
    title: 'Les pages se chargent lentement',
    category: 'technique',
    summary: 'Le catalogue interroge TMDB en direct : une connexion faible ralentit l’affichage.',
    body: [
      { type: 'list', items: [
        'Testez votre connexion Internet et fermez les onglets ou téléchargements gourmands.',
        'Rechargez la page.',
        'Si l’écran de chargement CINEVERSE reste affiché trop longtemps après l’ouverture d’un profil, des boutons « Réessayer » et « Retour aux profils » apparaissent : utilisez-les.',
        'Évitez de rafraîchir de nombreuses fois de suite : cela ne rend pas le chargement plus rapide.',
      ] },
    ],
    links: [PROFILES],
    keywords: ['lent', 'lenteur', 'chargement', 'long', 'bloque', 'performance', 'ecran de chargement', 'reessayer'],
  },
  {
    slug: 'difficultes-de-connexion',
    title: 'Difficultés de connexion',
    category: 'technique',
    summary: 'Les causes les plus fréquentes quand la connexion échoue.',
    body: [
      { type: 'list', items: [
        'Vérifiez l’adresse e-mail (c’est votre identifiant) et les majuscules du mot de passe.',
        'Après 5 essais en échec, la connexion est bloquée environ 15 minutes pour cette adresse : attendez avant de réessayer.',
        'Les cookies doivent être autorisés : sans eux, la connexion ne peut pas être maintenue.',
        'Si vous êtes renvoyé vers la page de connexion alors que vous étiez connecté, votre session a pu expirer ou être fermée depuis un autre appareil : reconnectez-vous.',
      ] },
      { type: 'p', text: 'Si vous ne vous souvenez plus du mot de passe, consultez l’article dédié : la réinitialisation par e-mail n’existe pas encore.' },
    ],
    links: [LOGIN, { label: 'Mot de passe oublié', href: '/help/mot-de-passe-oublie' }],
    keywords: ['connexion', 'impossible', 'echec', 'login', 'erreur', 'identifiants', 'cookies', 'deconnecte', 'expire'],
  },
  {
    slug: 'erreurs-code-pin',
    title: 'Erreurs lors de la saisie du code PIN',
    category: 'technique',
    summary: 'Que signifient les messages affichés sur l’écran du code PIN.',
    body: [
      { type: 'list', items: [
        '« Code PIN incorrect » : les 4 chiffres ne correspondent pas à ce profil. Vérifiez le profil choisi, puis ressaisissez.',
        '« Trop de tentatives. Réessayez dans … minutes. » : le profil est verrouillé temporairement.',
        'Message de connexion (« Connexion impossible… ») : le réseau a échoué, ce n’est pas une erreur de code ; ressaisissez le code.',
        '« Les deux codes ne correspondent pas » ou un code refusé comme trop simple : cela concerne la création d’un code, pas son ouverture.',
      ] },
      { type: 'p', text: 'Si vous ne retrouvez pas le code, définissez-en un nouveau avec le mot de passe de votre compte.' },
    ],
    links: [{ label: 'Blocage temporaire', href: '/help/blocage-temporaire-du-code-pin' }, { label: 'Code PIN oublié', href: '/help/code-pin-oublie' }],
    keywords: ['erreur', 'pin', 'incorrect', 'message', 'refuse', 'trop de tentatives', 'saisie'],
  },
  {
    slug: 'navigateurs-compatibles',
    title: 'Navigateurs compatibles',
    category: 'technique',
    summary: 'Utilisez un navigateur récent avec JavaScript et les cookies activés.',
    body: [
      { type: 'p', text: 'CINEVERSE est développé et testé avec un navigateur Chromium récent (Chrome, Edge). Les versions récentes de Firefox et de Safari devraient fonctionner, mais n’ont pas été testées de façon systématique.' },
      { type: 'list', items: ['Mettez votre navigateur à jour.', 'Activez JavaScript et les cookies : ils sont indispensables à la connexion.', 'Si un affichage est incorrect, essayez un autre navigateur puis signalez le problème.'] },
    ],
    links: [{ label: 'Signaler un problème', href: '/help/signaler-un-probleme' }],
    keywords: ['navigateur', 'chrome', 'firefox', 'safari', 'edge', 'compatibilite', 'version', 'mobile'],
  },
  {
    slug: 'signaler-un-probleme',
    title: 'Signaler un bug ou un problème',
    category: 'technique',
    summary: 'Les informations utiles à rassembler, et la voie de contact disponible.',
    body: [
      { type: 'p', text: 'Pour qu’un problème puisse être reproduit, notez :' },
      { type: 'list', items: [
        'ce que vous faisiez et ce que vous attendiez ;',
        'le message d’erreur exact, ou une capture d’écran ;',
        'la page concernée (adresse), votre navigateur et son système ;',
        'l’heure approximative du problème.',
      ] },
      { type: 'warning', text: 'N’incluez jamais votre mot de passe ni un code PIN dans un message ou une capture d’écran.' },
      { type: 'p', text: 'Envoyez ensuite ces informations avec le formulaire « Vous avez encore besoin d’aide ? » du Centre d’aide, en choisissant la catégorie « Assistance technique ».' },
      { type: 'note', text: 'Aucun e-mail de confirmation n’est envoyé automatiquement : conservez la référence affichée une fois la demande enregistrée.' },
    ],
    links: [{ label: 'Contacter le support', href: '/help#contact' }, { label: 'Comment fonctionne le support', href: '/help/contacter-le-support' }],
    keywords: ['bug', 'signaler', 'probleme', 'contact', 'support', 'erreur', 'rapport', 'capture'],
  },
  {
    slug: 'contacter-le-support',
    title: 'Contacter le support : comment ça fonctionne',
    category: 'technique',
    summary: 'Le formulaire du Centre d’aide enregistre votre demande ; voici ce qui est conservé et ce qui se passe ensuite.',
    body: [
      { type: 'steps', items: [
        'Descendez à la section « Vous avez encore besoin d’aide ? » du Centre d’aide (accessible sans connexion).',
        'Renseignez le sujet, la catégorie, votre adresse e-mail et votre message, puis cliquez sur « Envoyer ma demande ».',
        'Une fois la demande réellement enregistrée, une référence (par exemple CV-AB12CD34) s’affiche. Conservez-la.',
      ] },
      { type: 'h', text: 'Ce qui est conservé' },
      { type: 'list', items: [
        'Votre adresse e-mail, le sujet, la catégorie et le message.',
        'Le lien avec votre compte si vous étiez connecté au moment de l’envoi.',
        'Une empreinte chiffrée de votre adresse réseau et du message, utilisée uniquement contre le spam et les doublons.',
        'Ces données sont supprimées avec votre compte, et seule l’équipe de support peut les consulter.',
      ] },
      { type: 'warning', text: 'N’écrivez jamais votre mot de passe, un code PIN ou un jeton de connexion : un message qui semble en contenir est refusé, et le support ne vous les demandera jamais.' },
      { type: 'h', text: 'Suivre votre demande et lire les réponses' },
      { type: 'p', text: 'Si vous étiez connecté en envoyant la demande, elle apparaît dans Mon compte, sous « Mes demandes d’aide ». Vous y lisez les réponses de l’équipe, vous pouvez envoyer un message complémentaire et, si la demande était résolue ou fermée, la rouvrir. Une notification vous prévient lorsqu’une réponse arrive.' },
      { type: 'warning', text: 'Une demande envoyée sans être connecté ne peut pas être consultée ensuite : la référence seule ne donne accès à rien, pour que personne ne puisse lire la demande d’un autre. L’équipe ne peut pas y répondre depuis CINEVERSE.' },
      { type: 'note', text: 'Aucun e-mail de confirmation ni de réponse n’est envoyé automatiquement. Le nombre de demandes et de messages est limité pour éviter les abus.' },
    ],
    links: [{ label: 'Ouvrir le formulaire', href: '/help#contact' }, { label: 'Mes demandes d’aide', href: '/account/support' }, { label: 'Signaler un problème', href: '/help/signaler-un-probleme' }],
    keywords: ['contact', 'support', 'formulaire', 'ticket', 'reference', 'demande', 'aide', 'ecrire', 'message'],
  },
];

export const HELP_FAQ: HelpFaq[] = [
  { id: 'faq-creer-compte', category: 'compte', article: 'creer-un-compte', question: 'Comment créer un compte ?', answer: 'Sur la page de connexion, choisissez l’onglet « Inscription », saisissez votre nom, votre e-mail et un mot de passe d’au moins 12 caractères (minuscule, majuscule, chiffre), puis cliquez sur « Créer le compte ».', links: [LOGIN] },
  { id: 'faq-mdp-oublie', category: 'compte', article: 'mot-de-passe-oublie', question: 'J’ai oublié mon mot de passe, que faire ?', answer: 'La réinitialisation par e-mail n’existe pas encore dans CINEVERSE. Vérifiez l’adresse e-mail et les majuscules saisies ; si le mot de passe est perdu, la récupération n’est pas possible depuis l’application dans cette version.', keywords: ['reset', 'reinitialiser'] },
  { id: 'faq-changer-mdp', category: 'compte', article: 'changer-le-mot-de-passe', question: 'Comment changer mon mot de passe ?', answer: 'Ouvrez Mon compte, section « Mot de passe et sécurité », saisissez le mot de passe actuel puis le nouveau (deux fois). Vos autres sessions sont fermées automatiquement.', links: [ACCOUNT] },
  { id: 'faq-notifications', category: 'compte', article: 'notifications', question: 'À quoi sert la cloche et comment régler les notifications ?', answer: 'La cloche rassemble les notifications de sécurité, le suivi de vos demandes d’aide et les annonces de l’équipe. Le badge rouge n’apparaît que s’il y a des notifications non lues. Dans Mon compte, vous pouvez désactiver les annonces ; la sécurité et le suivi de vos demandes restent toujours actifs.', links: [ACCOUNT] },
  { id: 'faq-creer-pin', category: 'profils', article: 'creer-un-code-pin', question: 'Comment créer un code PIN ?', answer: 'Le code PIN, de 4 chiffres, se choisit et se confirme à la création du profil. Les codes trop simples (1111, 1234, 0000…) sont refusés. Un profil plus ancien vous demande d’en créer un à sa première ouverture.', links: [PROFILES] },
  { id: 'faq-pin-oublie', category: 'profils', article: 'code-pin-oublie', question: 'J’ai oublié le code PIN d’un profil : puis-je le récupérer ?', answer: 'Un code ne peut pas être retrouvé, mais vous pouvez en définir un nouveau : ouvrez « Gérer les profils », choisissez le profil, saisissez le mot de passe de votre compte puis « Changer le code PIN ». Rien n’est perdu.', links: [PROFILES] },
  { id: 'faq-pin-bloque', category: 'profils', article: 'blocage-temporaire-du-code-pin', question: 'Pourquoi mon profil est-il bloqué après plusieurs erreurs ?', answer: 'Après 5 codes incorrects en 15 minutes, le profil est verrouillé temporairement pour empêcher de deviner le code. Le message indique le temps d’attente ; même le bon code est refusé jusqu’à la fin du délai.' },
  { id: 'faq-changer-profil', category: 'profils', article: 'changer-de-profil', question: 'Comment changer de profil ?', answer: 'Ouvrez le menu de l’avatar en haut à droite et cliquez sur un autre profil : le code PIN de ce profil est toujours demandé.' },
  { id: 'faq-streaming', category: 'films', article: 'disponibilite-des-contenus', question: 'Puis-je regarder les films en entier sur CINEVERSE ?', answer: 'Non, pas pour le moment : CINEVERSE n’a aucune source de streaming autorisée. Vous pouvez consulter les fiches et regarder les bandes-annonces disponibles.', links: [CATALOG], keywords: ['streaming', 'lecture complete'] },
  { id: 'faq-bande-annonce', category: 'films', article: 'regarder-une-bande-annonce', question: 'Comment regarder une bande-annonce ?', answer: 'Sur la fiche d’un titre, cliquez sur « Bande-annonce ». Si le bouton n’apparaît pas, aucune vidéo n’est disponible pour ce titre.' },
  { id: 'faq-chercher', category: 'films', article: 'rechercher-et-filtrer', question: 'Comment rechercher un film ou une série ?', answer: 'Cliquez sur la loupe de la barre de navigation et saisissez un titre. Dans le catalogue, filtrez aussi par genre, année et note.', links: [CATALOG] },
  { id: 'faq-ma-liste', category: 'liste', article: 'ajouter-a-ma-liste', question: 'Comment ajouter un titre à Ma liste ?', answer: 'Sur la fiche d’un titre, cliquez sur « Ma liste ». Pour le retirer, cliquez de nouveau sur « Dans ma liste ».', links: [MYLIST] },
  { id: 'faq-liste-profil', category: 'liste', article: 'favoris-par-profil', question: 'Ma liste est-elle commune à tous les profils ?', answer: 'Non : Ma liste, les favoris et l’historique appartiennent à chaque profil et restent protégés par son code PIN.' },
  { id: 'faq-liste-vide', category: 'liste', article: 'retrouver-ma-liste-apres-reconnexion', question: 'Ma liste semble vide après une reconnexion', answer: 'Vos contenus sont enregistrés côté serveur. Vérifiez que vous avez ouvert le bon profil : chaque profil a sa propre liste.' },
  { id: 'faq-donnees', category: 'securite', article: 'gerer-les-donnees-du-compte', question: 'Puis-je télécharger mes données ?', answer: 'Oui : dans Mon compte › « Confidentialité et données », après avoir saisi votre mot de passe. Le fichier ne contient ni mot de passe, ni codes PIN, ni jetons de session.', links: [ACCOUNT] },
  { id: 'faq-supprimer', category: 'securite', article: 'supprimer-son-compte', question: 'Comment supprimer mon compte ?', answer: 'Dans Mon compte › « Confidentialité et données », avec votre mot de passe et la confirmation SUPPRIMER. La suppression est définitive.', links: [ACCOUNT] },
  { id: 'faq-sessions', category: 'securite', article: 'gerer-les-sessions-actives', question: 'Comment me déconnecter de mes autres appareils ?', answer: 'Dans Mon compte › « Appareils et sessions », fermez une session, les autres sessions, ou utilisez « Se déconnecter partout ».', links: [ACCOUNT] },
  { id: 'faq-images', category: 'technique', article: 'images-qui-ne-chargent-pas', question: 'Les affiches ne s’affichent pas, que faire ?', answer: 'Rechargez la page, vérifiez votre connexion et désactivez un éventuel bloqueur ou VPN : les affiches viennent du serveur d’images de TMDB.' },
  { id: 'faq-bug', category: 'technique', article: 'signaler-un-probleme', question: 'Comment signaler un problème ?', answer: 'Notez ce que vous faisiez, le message exact et la page concernée, sans jamais inclure de mot de passe ou de code PIN, puis envoyez-les avec le formulaire « Vous avez encore besoin d’aide ? ».', links: [{ label: 'Contacter le support', href: '/help#contact' }] },
  { id: 'faq-contact', category: 'technique', article: 'contacter-le-support', question: 'Comment contacter le support ?', answer: 'Utilisez le formulaire en bas du Centre d’aide : il fonctionne même sans connexion. Votre demande est enregistrée et une référence s’affiche. Connecté, vous retrouvez la demande et les réponses de l’équipe dans Mon compte ; sans connexion, aucune réponse ne peut vous être livrée. Aucun e-mail n’est envoyé automatiquement.', links: [{ label: 'Ouvrir le formulaire', href: '/help#contact' }, { label: 'Mes demandes d’aide', href: '/account/support' }], keywords: ['ticket', 'formulaire'] },
];

export const articleBySlug = (slug: string) => HELP_ARTICLES.find((article) => article.slug === slug);
export const categoryById = (id: CategoryId) => HELP_CATEGORIES.find((category) => category.id === id);
export const articlesInCategory = (id: CategoryId) => HELP_ARTICLES.filter((article) => article.category === id);
