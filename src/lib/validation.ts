import { z } from 'zod';
import { pinProblem } from './pin-rules';
import { SUPPORT_CATEGORY_IDS, SUPPORT_LIMITS, SUPPORT_STATUS_IDS, cleanText } from './support-rules';

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
  category: z.enum(SUPPORT_CATEGORY_IDS, { message: 'Choisissez une catégorie.' }),
  email: supportEmailSchema,
  message: z.string().transform(cleanText).pipe(z.string().min(SUPPORT_LIMITS.messageMin, `Le message doit contenir au moins ${SUPPORT_LIMITS.messageMin} caractères.`).max(SUPPORT_LIMITS.messageMax, `Le message ne peut pas dépasser ${SUPPORT_LIMITS.messageMax} caractères.`)),
  // spam traps: a hidden field real visitors never fill, and how long the form was open
  website: z.string().max(200).optional(),
  elapsedMs: z.number().int().min(0).max(7 * 24 * 3600 * 1000).optional(),
}).strict();

export const supportTicketPatchSchema = z.object({
  status: z.enum(SUPPORT_STATUS_IDS).optional(),
  adminNote: z.string().transform(cleanText).pipe(z.string().max(SUPPORT_LIMITS.noteMax)).optional(),
}).strict().refine((value) => value.status !== undefined || value.adminNote !== undefined, 'No changes supplied');
