import { createHash } from 'node:crypto';
import { SUPPORT_STATUSES, ticketReference } from './support-rules';
import type { NotificationCategory } from './notification-rules';

// Builders for the real events that notify a member. They are pure (no database), so tests can check every message.
// Rules: a message never contains a password, a PIN, a token or a hash; the only user data is the member's own profile
// name or ticket subject; the destination is an internal path; the dedupe key identifies the EVENT, so replaying it
// (a retried request, a repeated lockout) cannot notify twice.

export interface NotificationDraft {
  category: NotificationCategory;
  type: string;
  title: string;
  message: string;
  href: string | null;
  dedupeKey: string;
}

/** A short, non-reversible identifier of one event instance (for example one password change), safe to store. */
export const fingerprint = (value: string) => createHash('sha256').update(value).digest('hex').slice(0, 12);

const quote = (name: string) => `« ${name.trim().slice(0, 40)} »`;
const WINDOW = 15 * 60 * 1000;

export const passwordChanged = (newPasswordHash: string): NotificationDraft => ({
  category: 'security', type: 'password_changed',
  title: 'Mot de passe modifié',
  message: 'Le mot de passe de votre compte a été modifié et vos autres sessions ont été fermées. Si vous n’êtes pas à l’origine de ce changement, protégez votre compte sans attendre.',
  href: '/help/proteger-son-compte',
  dedupeKey: `password_changed:${fingerprint(newPasswordHash)}`,
});

export const pinSet = (profileId: string, profileName: string, newPinHash: string, created: boolean): NotificationDraft => ({
  category: 'security', type: created ? 'pin_created' : 'pin_changed',
  title: created ? 'Code PIN créé' : 'Code PIN modifié',
  message: created ? `Un code PIN a été créé pour le profil ${quote(profileName)}.` : `Le code PIN du profil ${quote(profileName)} a été modifié.`,
  href: '/profiles',
  dedupeKey: `${created ? 'pin_created' : 'pin_changed'}:${profileId}:${fingerprint(newPinHash)}`,
});

export const pinLockout = (profileId: string, profileName: string, now = Date.now()): NotificationDraft => ({
  category: 'security', type: 'pin_lockout',
  title: 'Profil temporairement verrouillé',
  message: `Le profil ${quote(profileName)} est verrouillé pendant quelques minutes après plusieurs codes PIN incorrects. Si ce n’était pas vous, changez son code PIN.`,
  href: '/profiles',
  dedupeKey: `pin_lockout:${profileId}:${Math.floor(now / WINDOW)}`, // one per lockout window, however many attempts follow
});

export const sessionsRevoked = (scope: 'others' | 'all', now = Date.now()): NotificationDraft => ({
  category: 'security', type: 'sessions_revoked',
  title: scope === 'all' ? 'Déconnexion de tous les appareils' : 'Autres sessions fermées',
  message: scope === 'all' ? 'Toutes vos sessions de connexion ont été fermées depuis Mon compte.' : 'Vos autres sessions de connexion ont été fermées depuis Mon compte.',
  href: '/account',
  dedupeKey: `sessions_revoked:${scope}:${Math.floor(now / 60000)}`,
});

export const ticketCreated = (ticketId: string, subject: string): NotificationDraft => ({
  category: 'support', type: 'ticket_created',
  title: 'Demande enregistrée',
  message: `Votre demande ${ticketReference(ticketId)} « ${subject.trim().slice(0, 60)} » a bien été enregistrée. L’équipe de support la consultera.`,
  href: `/account/support/${ticketId}`,
  dedupeKey: `ticket_created:${ticketId}`,
});

export const ticketStatusChanged = (ticketId: string, status: string, changedAtMs: number): NotificationDraft => {
  const label = SUPPORT_STATUSES.find((item) => item.id === status)?.label ?? status;
  const reference = ticketReference(ticketId);
  const title = status === 'resolved' ? 'Demande résolue' : status === 'closed' ? 'Demande fermée' : status === 'in_progress' ? 'Demande en cours de traitement' : 'Demande mise à jour';
  const message = status === 'resolved' ? `Votre demande ${reference} a été marquée comme résolue.` : `Le statut de votre demande ${reference} est maintenant « ${label} ».`;
  return { category: 'support', type: 'ticket_status', title, message, href: `/account/support/${ticketId}`, dedupeKey: `ticket_status:${ticketId}:${status}:${changedAtMs}` };
};

/** A support reply the author can read in their account. The text of the reply is never put in the notification. */
export const ticketReply = (ticketId: string, messageId: string): NotificationDraft => ({
  category: 'support', type: 'ticket_reply',
  title: 'Nouvelle réponse du support',
  message: `L’équipe de support a répondu à votre demande ${ticketReference(ticketId)}.`,
  href: `/account/support/${ticketId}`,
  dedupeKey: `ticket_reply:${messageId}`,
});

// ---- administrator notifications (types start with "admin_"; they are listed in the support administration) ----
const adminHref = (ticketId: string) => `/admin/support/tickets/${ticketId}`;

export const adminTicketNew = (ticketId: string, subject: string): NotificationDraft => ({
  category: 'support', type: 'admin_ticket_new',
  title: 'Nouvelle demande d’aide',
  message: `${ticketReference(ticketId)} : « ${subject.trim().slice(0, 60)} »`,
  href: adminHref(ticketId),
  dedupeKey: `admin_ticket_new:${ticketId}`,
});

export const adminUserReply = (ticketId: string, messageId: string): NotificationDraft => ({
  category: 'support', type: 'admin_user_reply',
  title: 'Nouvelle réponse d’un utilisateur',
  message: `L’auteur de la demande ${ticketReference(ticketId)} a envoyé un nouveau message.`,
  href: adminHref(ticketId),
  dedupeKey: `admin_user_reply:${messageId}`,
});

export const adminHighPriority = (ticketId: string, priorityLabel: string, changedAtMs: number): NotificationDraft => ({
  category: 'support', type: 'admin_high_priority',
  title: 'Demande prioritaire',
  message: `La demande ${ticketReference(ticketId)} est passée en priorité « ${priorityLabel} ».`,
  href: adminHref(ticketId),
  dedupeKey: `admin_high_priority:${ticketId}:${priorityLabel}:${changedAtMs}`,
});

export const adminAssigned = (ticketId: string, assigneeId: string, changedAtMs: number): NotificationDraft => ({
  category: 'support', type: 'admin_assigned',
  title: 'Demande assignée',
  message: `La demande ${ticketReference(ticketId)} vous a été assignée.`,
  href: adminHref(ticketId),
  dedupeKey: `admin_assigned:${ticketId}:${assigneeId}:${changedAtMs}`,
});

export const adminReopened = (ticketId: string, changedAtMs: number): NotificationDraft => ({
  category: 'support', type: 'admin_reopened',
  title: 'Demande rouverte',
  message: `La demande ${ticketReference(ticketId)} a été rouverte.`,
  href: adminHref(ticketId),
  dedupeKey: `admin_reopened:${ticketId}:${changedAtMs}`,
});
