import { z } from 'zod';
import { pinProblem } from './pin-rules';

export const emailSchema = z.string().trim().toLowerCase().email().max(254);
export const passwordSchema = z.string().min(12).max(128)
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
