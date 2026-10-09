import { SUPPORT_CATEGORIES } from './support-rules';

// Shared, client-safe definitions for the support administration: priorities, conversation limits, the contact-form
// categories (built-in plus database overrides) and the audit actions.

// ---------------------------------------------------------------- priorities
export const SUPPORT_PRIORITIES = [
  { level: 0, id: 'low', label: 'Basse' },
  { level: 1, id: 'normal', label: 'Normale' },
  { level: 2, id: 'high', label: 'Haute' },
  { level: 3, id: 'urgent', label: 'Urgente' },
] as const;
export type SupportPriorityId = (typeof SUPPORT_PRIORITIES)[number]['id'];
export const SUPPORT_PRIORITY_IDS = SUPPORT_PRIORITIES.map((item) => item.id) as [SupportPriorityId, ...SupportPriorityId[]];
export const priorityId = (level: number): SupportPriorityId => SUPPORT_PRIORITIES.find((item) => item.level === level)?.id ?? 'normal';
export const priorityLevel = (id: string) => SUPPORT_PRIORITIES.find((item) => item.id === id)?.level ?? 1;
export const priorityLabel = (level: number) => SUPPORT_PRIORITIES.find((item) => item.level === level)?.label ?? 'Normale';
/** High and urgent tickets are the ones that raise a "high priority" alert. */
export const isHighPriority = (level: number) => level >= 2;

// ---------------------------------------------------------------- conversation
export const SUPPORT_MESSAGE_LIMITS = { bodyMin: 1, bodyMax: 2000, perTicketPerHour: 10, perUserPerDay: 60, duplicateWindowMs: 10 * 60 * 1000 } as const;

// ---------------------------------------------------------------- categories
export const CATEGORY_ID_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export interface CategoryRow { id: string; label: string; enabled: boolean; position: number }
export interface MergedCategory { id: string; label: string; enabled: boolean; position: number; builtin: boolean }

/**
 * The categories of the contact form: the built-in ones, overridden (renamed, disabled, moved) or extended by database
 * rows. With no rows the result is exactly the built-in list, so a database problem can never empty the form.
 */
export function mergeCategories(rows: CategoryRow[]): MergedCategory[] {
  const byId = new Map(rows.map((row) => [row.id, row]));
  const merged: MergedCategory[] = SUPPORT_CATEGORIES.map((category, index) => {
    const row = byId.get(category.id);
    return { id: category.id, label: row?.label ?? category.label, enabled: row ? row.enabled : true, position: row ? row.position : (index + 1) * 10, builtin: true };
  });
  for (const row of rows) if (!SUPPORT_CATEGORIES.some((category) => category.id === row.id)) merged.push({ id: row.id, label: row.label, enabled: row.enabled, position: row.position, builtin: false });
  return merged.sort((a, b) => a.position - b.position || Number(b.builtin) - Number(a.builtin));
}

export const categoryLabel = (categories: { id: string; label: string }[], id: string) => categories.find((category) => category.id === id)?.label ?? id;

// ---------------------------------------------------------------- audit
export const AUDIT_ACTIONS = [
  'ticket.status_changed', 'ticket.priority_changed', 'ticket.assigned', 'ticket.deleted', 'ticket.reply', 'ticket.internal_note', 'ticket.note_updated',
  'kb.article_created', 'kb.article_updated', 'kb.article_published', 'kb.article_unpublished', 'kb.article_restored', 'kb.article_deleted',
  'kb.faq_created', 'kb.faq_updated', 'kb.faq_published', 'kb.faq_unpublished', 'kb.faq_restored', 'kb.faq_deleted', 'kb.faq_reordered',
  'settings.availability_changed', 'settings.category_changed', 'settings.category_created',
  'announcement.sent', 'announcement.withdrawn',
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export const AUDIT_LABELS: Record<AuditAction, string> = {
  'ticket.status_changed': 'Statut modifié',
  'ticket.priority_changed': 'Priorité modifiée',
  'ticket.assigned': 'Assignation modifiée',
  'ticket.deleted': 'Ticket supprimé',
  'ticket.reply': 'Réponse envoyée',
  'ticket.internal_note': 'Note interne ajoutée',
  'ticket.note_updated': 'Note interne (ancienne) modifiée',
  'kb.article_created': 'Article créé',
  'kb.article_updated': 'Article modifié',
  'kb.article_published': 'Article publié',
  'kb.article_unpublished': 'Article dépublié',
  'kb.article_restored': 'Article rétabli (version d’origine)',
  'kb.article_deleted': 'Article supprimé',
  'kb.faq_created': 'Question créée',
  'kb.faq_updated': 'Question modifiée',
  'kb.faq_published': 'Question publiée',
  'kb.faq_unpublished': 'Question masquée',
  'kb.faq_restored': 'Question rétablie (version d’origine)',
  'kb.faq_deleted': 'Question supprimée',
  'kb.faq_reordered': 'Questions réordonnées',
  'settings.availability_changed': 'Disponibilité modifiée',
  'settings.category_changed': 'Catégorie modifiée',
  'settings.category_created': 'Catégorie créée',
  'announcement.sent': 'Annonce envoyée',
  'announcement.withdrawn': 'Annonce retirée',
};
