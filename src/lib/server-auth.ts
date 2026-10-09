import 'server-only';
import { getServerSession } from 'next-auth';
import { authOptions } from './auth';

export async function authenticatedUserId() {
  if (!process.env.AUTH_SECRET && !process.env.NEXTAUTH_SECRET) return null;
  try {
    const session = await getServerSession(authOptions);
    return session?.user?.id || null;
  } catch {
    return null;
  }
}
