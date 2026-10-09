import 'server-only';
import { authenticatedUserId } from './server-auth';
import { activeProfileAccess } from './profile-access';
export { restrictItemsForProfile } from './content-policy';

export async function currentProfileAccess() {
  if (!process.env.DATABASE_URL) return null;
  const userId = await authenticatedUserId();
  return userId ? activeProfileAccess(userId) : null;
}
