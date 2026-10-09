import { z } from 'zod';

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

export const profilePatchSchema = profileInputSchema.partial().refine((value) => Object.keys(value).length > 0, 'No changes supplied');
export const profileSelectionSchema = z.object({ profileId: z.string().cuid().nullable() });
export const mediaActionSchema = z.object({ mediaId: z.string().regex(/^(movie|tv):\d+$/) });
export const recommendationRequestSchema = z.object({ profileId: z.string().cuid().optional() });
export const progressInputSchema = mediaActionSchema.extend({
  seasonNumber: z.number().int().min(0).nullable().optional(),
  episodeNumber: z.number().int().min(0).nullable().optional(),
  positionSeconds: z.number().int().min(0),
  durationSeconds: z.number().int().positive().max(60 * 60 * 24),
}).refine((value) => value.positionSeconds <= value.durationSeconds, { message: 'Position exceeds duration', path: ['positionSeconds'] });
