// A deliberately small, fixed artwork set for the loading screen. The same w185 files are reused across columns and
// duplicated only in the DOM for seamless animation, so the browser downloads each URL once and no TMDB API call is
// made while a route is loading.
const POSTER_BASE = 'https://image.tmdb.org/t/p/w185';

export interface LoadingPoster {
  title: string;
  url: string;
  tilt: number;
}

export interface LoadingPosterColumn {
  id: string;
  side: 'left' | 'right';
  position: 'outer' | 'middle' | 'inner';
  /** 1 = every screen, 2 = tablet and up, 3 = desktop only. */
  tier: 1 | 2 | 3;
  direction: 'up' | 'down';
  duration: number;
  delay: number;
  tilt: number;
  opacity: number;
  posters: LoadingPoster[];
}

type PosterSeed = readonly [title: string, path: string, tilt: number];

const seeds = {
  interstellar: ['Interstellar', '/yQvGrMoipbRoddT0ZR8tPoR7NfX.jpg', -1.2],
  dune: ['Dune: Part Two', '/6izwz7rsy95ARzTR3poZ8H6c5pp.jpg', 0.8],
  darkKnight: ['The Dark Knight', '/qJ2tW6WMUDux911r6m7haRef0WH.jpg', -0.6],
  bladeRunner: ['Blade Runner 2049', '/gajva2L0rPYkEWjzgFlBXCAVBE5.jpg', 1.1],
  madMax: ['Mad Max: Fury Road', '/ulcAi4dKpAjHwYGS08vNyx9H6I9.jpg', -0.9],
  oppenheimer: ['Oppenheimer', '/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg', 0.6],
  inception: ['Inception', '/xlaY2zyzMfkhk0HSC5VUwzoZPU1.jpg', -1],
  parasite: ['Parasite', '/7IiTTgloJzvGI1TAYymCfbfl3vT.jpg', 0.9],
  pulpFiction: ['Pulp Fiction', '/vQWk5YBFWF4bZaofAbv0tShwBvQ.jpg', -0.7],
  gladiator: ['Gladiator', '/aDb548BOkFfI4nFm0kx8A3Ezh7H.jpg', 1.2],
} satisfies Record<string, PosterSeed>;

const makePosters = (...items: PosterSeed[]): LoadingPoster[] =>
  items.map(([title, path, tilt]) => ({ title, url: `${POSTER_BASE}${path}`, tilt }));

export const LOADING_POSTER_COLUMNS: LoadingPosterColumn[] = [
  {
    id: 'left-outer',
    side: 'left',
    position: 'outer',
    tier: 1,
    direction: 'up',
    duration: 47,
    delay: -19,
    tilt: -2.4,
    opacity: 0.72,
    posters: makePosters(seeds.interstellar, seeds.darkKnight, seeds.dune, seeds.madMax, seeds.bladeRunner, seeds.parasite, seeds.oppenheimer, seeds.inception, seeds.gladiator, seeds.pulpFiction),
  },
  {
    id: 'left-middle',
    side: 'left',
    position: 'middle',
    tier: 2,
    direction: 'down',
    duration: 57,
    delay: -38,
    tilt: 1.5,
    opacity: 0.58,
    posters: makePosters(seeds.parasite, seeds.oppenheimer, seeds.inception, seeds.gladiator, seeds.pulpFiction, seeds.dune, seeds.bladeRunner, seeds.interstellar, seeds.darkKnight, seeds.madMax),
  },
  {
    id: 'left-inner',
    side: 'left',
    position: 'inner',
    tier: 3,
    direction: 'up',
    duration: 66,
    delay: -43,
    tilt: -0.8,
    opacity: 0.4,
    posters: makePosters(seeds.dune, seeds.bladeRunner, seeds.interstellar, seeds.parasite, seeds.oppenheimer, seeds.pulpFiction, seeds.madMax, seeds.gladiator, seeds.inception, seeds.darkKnight),
  },
  {
    id: 'right-outer',
    side: 'right',
    position: 'outer',
    tier: 1,
    direction: 'down',
    duration: 50,
    delay: -31,
    tilt: 2.4,
    opacity: 0.72,
    posters: makePosters(seeds.oppenheimer, seeds.gladiator, seeds.parasite, seeds.inception, seeds.pulpFiction, seeds.darkKnight, seeds.dune, seeds.interstellar, seeds.bladeRunner, seeds.madMax),
  },
  {
    id: 'right-middle',
    side: 'right',
    position: 'middle',
    tier: 2,
    direction: 'up',
    duration: 60,
    delay: -27,
    tilt: -1.5,
    opacity: 0.58,
    posters: makePosters(seeds.darkKnight, seeds.interstellar, seeds.madMax, seeds.dune, seeds.bladeRunner, seeds.inception, seeds.pulpFiction, seeds.oppenheimer, seeds.parasite, seeds.gladiator),
  },
  {
    id: 'right-inner',
    side: 'right',
    position: 'inner',
    tier: 3,
    direction: 'down',
    duration: 69,
    delay: -51,
    tilt: 0.8,
    opacity: 0.4,
    posters: makePosters(seeds.inception, seeds.pulpFiction, seeds.oppenheimer, seeds.darkKnight, seeds.dune, seeds.gladiator, seeds.parasite, seeds.bladeRunner, seeds.interstellar, seeds.madMax),
  },
];
