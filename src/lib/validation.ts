import { z } from 'zod';
import { pinProblem } from './pin-rules';
import { SUPPORT_LIMITS, SUPPORT_STATUS_IDS, cleanText } from './support-rules';
import { ANNOUNCEMENT_CATEGORIES, NOTIFICATION_LIMITS, isSafeInternalPath } from './notification-rules';
import { CATEGORY_ID_PATTERN, SUPPORT_MESSAGE_LIMITS, SUPPORT_PRIORITY_IDS } from './support-meta';
import { KB_LIMITS } from './kb-text';

export const emailSchema = z.string().trim().toLowerCase().email().max(254);
export const passwordSchema = z.string().min(12, 'Le mot de passe doit contenir au moins 12 caractères.').max(128, 'Le mot de passe ne peut pas dépasser 128 caractères.')
  .regex(/[a-z]/, 'Une minuscule est requise')
  .regex(/[A-Z]/, 'Une majuscule est requise')
  .regex(/[0-9]/, 'Un chiffre est requis');

export const loginSchema = z.object({ email: emailSchema, password: z.string().min(1).max(128) });
export const registrationSchema = z.object({ name: z.string().trim().min(2).max(60), email: emailSchema, password: passwordSchema });

export const profileInputSchema = z.object({
  name: z.string().trim().min(1).max(24),
  avatar: z.string().trim().min(1).max(64),
  isKids: z.boolean(),
  maturityLevel: z.number().int().min(3).max(18),
  preferences: z.array(z.string().trim().min(1).max(50)).max(20),
  language: z.string().trim().min(2).max(12).default('fr-FR'),
  parentalPin: z.string().regex(/^\d{4}$/).optional().or(z.literal('')),
});

// A profile PIN: exactly four digits and not trivially guessable (0000, 1234, 1111...).
export const pinSchema = z.string().regex(/^\d{4}$/, 'Le code PIN doit contenir exactement 4 chiffres.').superRefine((pin, ctx) => {
  const problem = pinProblem(pin);
  if (problem) ctx.addIssue({ code: 'custom', message: problem });
});
const accountPasswordSchema = z.string().min(1).max(128);
const pinsMatch = (value: { pin: string; confirmPin: string }) => value.pin === value.confirmPin;
const pinsMatchMessage = { message: 'Les deux codes PIN ne correspondent pas.', path: ['confirmPin'] };

// Creating a profile requires its own PIN (entered twice).
export const profileCreateSchema = profileInputSchema.extend({ pin: pinSchema, confirmPin: z.string() }).refine(pinsMatch, pinsMatchMessage);
// Editing a profile is a management action: it needs fresh authentication (the account password).
export const profilePatchSchema = profileInputSchema.extend({ language: z.string().trim().min(2).max(12).optional() }).partial().extend({ password: accountPasswordSchema }) // no default: an edit must not silently reset the language
  .refine((value) => Object.keys(value).some((key) => key !== 'password'), 'No changes supplied');
// An empty parentalPin is what the editor sends for a profile without parental settings, so it is accepted like in profileInputSchema.
export const profileDeleteSchema = z.object({ password: accountPasswordSchema, parentalPin: z.string().regex(/^\d{4}$/).optional().or(z.literal('')) });
export const pinUnlockSchema = z.object({ pin: z.string().regex(/^\d{4}$/) });
// First-time PIN for a profile created before PIN protection needs no password; changing an existing PIN does.
export const pinSetSchema = z.object({ pin: pinSchema, confirmPin: z.string(), password: accountPasswordSchema.optional() }).refine(pinsMatch, pinsMatchMessage);
export const profileSelectionSchema = z.object({ profileId: z.string().cuid().nullable() });
export const mediaActionSchema = z.object({ mediaId: z.string().regex(/^(movie|tv):\d+$/) });
export const recommendationRequestSchema = z.object({ profileId: z.string().cuid().optional() });
export const progressInputSchema = mediaActionSchema.extend({
  seasonNumber: z.number().int().min(0).nullable().optional(),
  episodeNumber: z.number().int().min(0).nullable().optional(),
  positionSeconds: z.number().int().min(0),
  durationSeconds: z.number().int().positive().max(60 * 60 * 24),
}).refine((value) => value.positionSeconds <= value.durationSeconds, { message: 'Position exceeds duration', path: ['positionSeconds'] });

// ---- Account management (/account) ----
export const accountNameSchema = z.object({ name: z.string().trim().min(2, 'Le nom doit contenir au moins 2 caractères.').max(60, 'Le nom ne peut pas dépasser 60 caractères.') }).strict();
export const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1, 'Saisissez votre mot de passe actuel.').max(128),
  newPassword: passwordSchema,
  confirmPassword: z.string().max(128),
}).strict()
  .refine((value) => value.newPassword === value.confirmPassword, { message: 'La confirmation ne correspond pas au nouveau mot de passe.', path: ['confirmPassword'] })
  .refine((value) => value.newPassword !== value.currentPassword, { message: 'Le nouveau mot de passe doit être différent de l’actuel.', path: ['newPassword'] });
export const ACCOUNT_DELETE_PHRASE = 'SUPPRIMER';
export const accountDeleteSchema = z.object({ password: accountPasswordSchema, confirmation: z.literal(ACCOUNT_DELETE_PHRASE) }).strict();
export const accountExportSchema = z.object({ password: accountPasswordSchema }).strict();
export const sessionRevokeSchema = z.union([
  z.object({ scope: z.enum(['others', 'all']) }).strict(),
  z.object({ sessionId: z.string().min(1).max(64) }).strict(),
]);

// ---- Support requests (Help Center) ----
const supportEmailSchema = z.string().trim().toLowerCase().min(1, 'Saisissez votre adresse e-mail.').email('Cette adresse e-mail n’est pas valide.').max(254, 'Cette adresse e-mail est trop longue.');
export const supportRequestSchema = z.object({
  subject: z.string().transform(cleanText).pipe(z.string().min(SUPPORT_LIMITS.subjectMin, `Le sujet doit contenir au moins ${SUPPORT_LIMITS.subjectMin} caractères.`).max(SUPPORT_LIMITS.subjectMax, `Le sujet ne peut pas dépasser ${SUPPORT_LIMITS.subjectMax} caractères.`)),
  category: z.string({ message: 'Choisissez une catégorie.' }).regex(CATEGORY_ID_PATTERN, 'Choisissez une catégorie.').max(40, 'Choisissez une catégorie.'),
  email: supportEmailSchema,
  message: z.string().transform(cleanText).pipe(z.string().min(SUPPORT_LIMITS.messageMin, `Le message doit contenir au moins ${SUPPORT_LIMITS.messageMin} caractères.`).max(SUPPORT_LIMITS.messageMax, `Le message ne peut pas dépasser ${SUPPORT_LIMITS.messageMax} caractères.`)),
  // spam traps: a hidden field real visitors never fill, and how long the form was open
  website: z.string().max(200).optional(),
  elapsedMs: z.number().int().min(0).max(7 * 24 * 3600 * 1000).optional(),
}).strict();

export const supportTicketPatchSchema = z.object({
  status: z.enum(SUPPORT_STATUS_IDS).optional(),
  adminNote: z.string().transform(cleanText).pipe(z.string().max(SUPPORT_LIMITS.noteMax)).optional(),
  priority: z.enum(SUPPORT_PRIORITY_IDS).optional(),
  // null removes the assignment; a string must be the id of a support administrator (checked on the server)
  assignedToId: z.union([z.string().min(10).max(40), z.null()]).optional(),
}).strict().refine((value) => value.status !== undefined || value.adminNote !== undefined || value.priority !== undefined || value.assignedToId !== undefined, 'No changes supplied');

// ---- Support conversation ----
const messageBody = z.string().transform(cleanText).pipe(z.string().min(SUPPORT_MESSAGE_LIMITS.bodyMin, 'Écrivez votre message.').max(SUPPORT_MESSAGE_LIMITS.bodyMax, `Le message ne peut pas dépasser ${SUPPORT_MESSAGE_LIMITS.bodyMax} caractères.`));
export const userSupportMessageSchema = z.object({ body: messageBody, elapsedMs: z.number().int().min(0).max(7 * 24 * 3600 * 1000).optional() }).strict();
export const staffSupportMessageSchema = z.object({ body: messageBody, visibility: z.enum(['public', 'internal']) }).strict();

// ---- Support administration queries ----
const isoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date invalide.');
export const adminTicketListQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  status: z.enum(SUPPORT_STATUS_IDS).optional(),
  category: z.string().regex(CATEGORY_ID_PATTERN).max(40).optional(),
  priority: z.enum(SUPPORT_PRIORITY_IDS).optional(),
  assignee: z.union([z.literal('me'), z.literal('unassigned'), z.string().min(10).max(40)]).optional(),
  attention: z.literal('1').optional(),
  from: isoDay.optional(),
  to: isoDay.optional(),
  sort: z.enum(['newest', 'oldest', 'priority', 'updated']).default('newest'),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});
export const adminAnalyticsQuerySchema = z.object({ from: isoDay.optional(), to: isoDay.optional(), granularity: z.enum(['day', 'week', 'month']).default('day') });
export const adminAuditQuerySchema = z.object({ action: z.string().max(60).optional(), page: z.coerce.number().int().min(1).max(10_000).default(1) });

// ---- Support settings ----
export const supportAvailabilitySchema = z.object({ enabled: z.boolean(), text: z.string().transform(cleanText).pipe(z.string().max(300, 'Le texte ne peut pas dépasser 300 caractères.')) }).strict()
  .refine((value) => !value.enabled || value.text.length >= 5, { message: 'Saisissez le texte à afficher.', path: ['text'] });
export const supportCategoryCreateSchema = z.object({ id: z.string().regex(CATEGORY_ID_PATTERN, 'Identifiant invalide (lettres minuscules, chiffres, tirets).').min(2).max(30), label: z.string().transform(cleanText).pipe(z.string().min(2, 'Libellé trop court.').max(40, 'Libellé trop long.')) }).strict();
export const supportCategoryPatchSchema = z.object({ label: z.string().transform(cleanText).pipe(z.string().min(2).max(40)).optional(), enabled: z.boolean().optional(), move: z.enum(['up', 'down']).optional() }).strict()
  .refine((value) => value.label !== undefined || value.enabled !== undefined || value.move !== undefined, 'No changes supplied');
export const supportAdminPreferenceSchema = z.object({
  notifyNewTicket: z.boolean().optional(), notifyUserReply: z.boolean().optional(), notifyHighPriority: z.boolean().optional(), notifyAssigned: z.boolean().optional(), notifyReopened: z.boolean().optional(),
}).strict().refine((value) => Object.values(value).some((entry) => entry !== undefined), 'No changes supplied');

// ---- Knowledge base ----
const kbLink = z.object({ label: z.string().transform(cleanText).pipe(z.string().min(1).max(KB_LIMITS.labelMax)), href: z.string().trim().refine(isSafeInternalPath, 'Lien interne invalide.') }).strict();
const kbKeywords = z.array(z.string().transform(cleanText).pipe(z.string().min(1).max(KB_LIMITS.keywordMax))).max(KB_LIMITS.keywords);
const kbCategory = z.enum(['compte', 'profils', 'films', 'liste', 'securite', 'technique'], { message: 'Choisissez une rubrique.' });
export const kbArticleSchema = z.object({
  slug: z.string().regex(CATEGORY_ID_PATTERN, 'Adresse invalide (lettres minuscules, chiffres, tirets).').min(3).max(KB_LIMITS.slugMax).optional(),
  title: z.string().transform(cleanText).pipe(z.string().min(5, 'Titre trop court.').max(KB_LIMITS.titleMax, 'Titre trop long.')),
  category: kbCategory,
  summary: z.string().transform(cleanText).pipe(z.string().min(10, 'Résumé trop court.').max(KB_LIMITS.summaryMax, 'Résumé trop long.')),
  content: z.string().max(60_000),
  keywords: kbKeywords.default([]),
  links: z.array(kbLink).max(KB_LIMITS.links).default([]),
  status: z.enum(['draft', 'published', 'archived']).default('draft'),
}).strict();
export const kbFaqSchema = z.object({
  question: z.string().transform(cleanText).pipe(z.string().min(5, 'Question trop courte.').max(KB_LIMITS.questionMax, 'Question trop longue.')),
  answer: z.string().transform(cleanText).pipe(z.string().min(10, 'Réponse trop courte.').max(KB_LIMITS.answerMax, 'Réponse trop longue.')),
  category: kbCategory,
  articleSlug: z.union([z.string().regex(CATEGORY_ID_PATTERN).max(KB_LIMITS.slugMax), z.literal(''), z.null()]).optional(),
  keywords: kbKeywords.default([]),
  links: z.array(kbLink).max(KB_LIMITS.links).default([]),
  status: z.enum(['draft', 'published', 'archived']).default('draft'),
}).strict();
export const kbFaqOrderSchema = z.object({ keys: z.array(z.string().min(2).max(60)).min(1).max(200) }).strict();

// ---- Notifications ----
export const notificationListQuerySchema = z.object({
  filter: z.enum(['all', 'unread']).default('all'),
  limit: z.coerce.number().int().min(1).max(NOTIFICATION_LIMITS.pageMax).default(NOTIFICATION_LIMITS.pageDefault),
  cursor: z.string().max(80).optional(),
});
export const notificationReadSchema = z.object({ read: z.boolean() }).strict();
export const notificationPreferencesSchema = z.object({ catalogue: z.boolean().optional(), service: z.boolean().optional() }).strict()
  .refine((value) => value.catalogue !== undefined || value.service !== undefined, 'No changes supplied');
const internalPathSchema = z.string().trim().refine(isSafeInternalPath, 'La destination doit être une page interne de CINEVERSE (par exemple /films-series-catalog).');
export const announcementSchema = z.object({
  category: z.enum(ANNOUNCEMENT_CATEGORIES, { message: 'Choisissez une catégorie.' }),
  title: z.string().transform(cleanText).pipe(z.string().min(3, 'Le titre doit contenir au moins 3 caractères.').max(NOTIFICATION_LIMITS.titleMax, `Le titre ne peut pas dépasser ${NOTIFICATION_LIMITS.titleMax} caractères.`)),
  message: z.string().transform(cleanText).pipe(z.string().min(5, 'Le message doit contenir au moins 5 caractères.').max(NOTIFICATION_LIMITS.messageMax, `Le message ne peut pas dépasser ${NOTIFICATION_LIMITS.messageMax} caractères.`)),
  href: z.union([internalPathSchema, z.literal('')]).optional(),
}).strict();
