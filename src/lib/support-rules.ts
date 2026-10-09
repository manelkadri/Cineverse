// Shared, client-safe rules for support requests: categories, statuses, size limits and the check that keeps secrets
// out of support messages. The server applies exactly the same rules (they are repeated in the browser only to warn early).

export const SUPPORT_CATEGORIES = [
  { id: 'login', label: 'Compte et connexion' },
  { id: 'profiles', label: 'Profils et codes PIN' },
  { id: 'catalog', label: 'Films et séries' },
  { id: 'list', label: 'Ma liste et favoris' },
  { id: 'privacy', label: 'Confidentialité et sécurité' },
  { id: 'technical', label: 'Assistance technique' },
  { id: 'other', label: 'Autre demande' },
] as const;

export const SUPPORT_STATUSES = [
  { id: 'open', label: 'Ouverte' },
  { id: 'in_progress', label: 'En cours' },
  { id: 'resolved', label: 'Résolue' },
  { id: 'closed', label: 'Fermée' },
] as const;

export type SupportCategoryId = (typeof SUPPORT_CATEGORIES)[number]['id'];
export type SupportStatusId = (typeof SUPPORT_STATUSES)[number]['id'];

export const SUPPORT_CATEGORY_IDS = SUPPORT_CATEGORIES.map((category) => category.id) as [SupportCategoryId, ...SupportCategoryId[]];
export const SUPPORT_STATUS_IDS = SUPPORT_STATUSES.map((status) => status.id) as [SupportStatusId, ...SupportStatusId[]];

export const SUPPORT_LIMITS = {
  subjectMin: 3,
  subjectMax: 120,
  messageMin: 20,
  messageMax: 2000,
  noteMax: 2000,
  maxLinks: 3,
  /** A form submitted faster than this was not filled in by a person. */
  minFillMs: 2500,
} as const;

/** Normalises line breaks and removes control characters. */
export const cleanText = (value: string) => value.replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim();

export const countLinks = (text: string) => (text.match(/https?:\/\/|www\./gi) ?? []).length;

const SENSITIVE_PATTERNS: RegExp[] = [
  // "mot de passe : abc123", "password=hunter2" (a value after a colon or equals sign)
  /(mot de passe|motdepasse|password|passwd|mdp|pwd)\s*[:=]\s*\S{3,}/i,
  // "mon mot de passe est Abc123!" (a value with a digit or symbol, so "est oublié" is not flagged)
  /(mot de passe|password|mdp)\s+(est|is)\s+(?=\S*[0-9!@#$%^&*_-])\S{5,}/i,
  // "code PIN 1234", "pin: 7392", "mon pin est 5038"
  /\bpin\b\s*(est|is)?\s*[:=]?\s*\d{4}\b/i,
  // session or authentication tokens, hashes and secrets
  /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\./,
  /\$2[aby]\$\d{2}\$/,
  /\bbearer\s+[A-Za-z0-9._~+/-]{20,}/i,
  /(__secure-|__host-)?(next-auth\.)?(session-token|csrf-token)\s*[:=]/i,
  /\bcv-unlock\s*[:=]/i,
  /\b(auth_secret|nextauth_secret|pin_pepper|database_url|api[_-]?key|secret[_-]?key)\s*[:=]/i,
  /postgres(ql)?:\/\/\S+:\S+@/i,
];

/** True when the text looks like it contains a password, PIN, token or secret. The match itself is never returned or stored. */
export function containsSensitiveContent(text: string) {
  return SENSITIVE_PATTERNS.some((pattern) => pattern.test(text));
}

export const SENSITIVE_CONTENT_MESSAGE = 'Votre message semble contenir un mot de passe, un code PIN ou un jeton de connexion. Retirez-le : le support ne vous demandera jamais ces informations.';

export type AdminStatus = 'admin' | 'not-admin' | 'unavailable';

/**
 * Turns the outcome of reading a user's support flag into a decision. A missing user or a false flag is "not-admin";
 * a failed read (database error, column or client out of date) is "unavailable". Both deny access: the difference is
 * only that an unavailable check is reported as a server error instead of a plain 404, so a broken check is never
 * mistaken for a normal refusal.
 */
export async function adminStatus(read: () => Promise<{ isSupportAdmin: boolean } | null>): Promise<AdminStatus> {
  try {
    const user = await read();
    return user?.isSupportAdmin === true ? 'admin' : 'not-admin';
  } catch {
    return 'unavailable';
  }
}
