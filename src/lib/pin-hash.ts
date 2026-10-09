import { createHmac } from 'node:crypto';
import { compare, hash } from 'bcryptjs';

// Pure PIN hashing (no database, no environment), so the pepper-migration rules can be unit-tested.
// A PIN is run through HMAC-SHA256 keyed with a server-side pepper and bound to the profile id, then bcrypt (cost 12).
const material = (pepper: string, profileId: string, pin: string) => createHmac('sha256', pepper).update(`cineverse-profile-pin|${profileId}|${pin}`).digest('hex');

export const hashPinWithPepper = (pepper: string, profileId: string, pin: string, cost = 12) => hash(material(pepper, profileId, pin), cost);

/**
 * 'current' = the stored hash matches the primary pepper, 'legacy' = it matches one of the older peppers (the caller
 * should upgrade it now that the plaintext PIN is proven), null = wrong PIN. Every candidate is always compared in order.
 */
export async function verifyPinWithPeppers(primary: string, fallbacks: string[], profileId: string, pin: string, stored: string): Promise<'current' | 'legacy' | null> {
  if (await compare(material(primary, profileId, pin), stored)) return 'current';
  for (const pepper of fallbacks) if (await compare(material(pepper, profileId, pin), stored)) return 'legacy';
  return null;
}
