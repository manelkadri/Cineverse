import 'server-only';
import { randomUUID } from 'node:crypto';
import { compare } from 'bcryptjs';
import type { NextAuthOptions, Session } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { PrismaAdapter } from '@next-auth/prisma-adapter';
import { prisma } from './prisma';
import { authIdentity, AuthRateLimitError, enforceAuthRateLimit, isAuthRuntimeConfigured, recordAuthAttempt } from './auth-security';
import { loginSchema } from './validation';

const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
  session: { strategy: 'jwt', maxAge: SESSION_MAX_AGE_SECONDS },
  pages: { signIn: '/login' },
  providers: [
    CredentialsProvider({
      name: 'Email et mot de passe',
      credentials: { email: { label: 'Email', type: 'email' }, password: { label: 'Mot de passe', type: 'password' } },
      async authorize(credentials, request) {
        if (!isAuthRuntimeConfigured()) return null;
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;
        const { email, password } = parsed.data;
        const identity = authIdentity(email, request.headers);
        try {
          await enforceAuthRateLimit(identity);
        } catch (error) {
          if (error instanceof AuthRateLimitError) return null;
          throw error;
        }
        const user = await prisma.user.findUnique({ where: { email } });
        const valid = Boolean(user?.passwordHash && await compare(password, user.passwordHash));
        await recordAuthAttempt(identity, valid);
        if (!valid || !user?.email) return null;
        return { id: user.id, email: user.email, name: user.name, image: user.image };
      },
    }),
  ],
  callbacks: {
    // Every login gets a server-side Session row whose id travels inside the signed JWT.
    // Logging out deletes the row, so a copied cookie stops working immediately.
    async jwt({ token, user }) {
      if (user) {
        const sid = randomUUID();
        await prisma.session.create({ data: { sessionToken: sid, userId: user.id, expires: new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000) } });
        await prisma.session.deleteMany({ where: { expires: { lt: new Date() } } }).catch(() => undefined);
        token.userId = user.id;
        token.sid = sid;
      }
      return token;
    },
    async session({ session, token }) {
      const sid = typeof token.sid === 'string' ? token.sid : '';
      const userId = String(token.userId ?? token.sub ?? '');
      const active = sid && userId
        ? await prisma.session.findFirst({ where: { sessionToken: sid, userId, expires: { gt: new Date() } }, select: { id: true } })
        : null;
      // An empty object makes NextAuth report "no session" (null) to getServerSession and /api/auth/session.
      if (!active) return {} as Session;
      if (session.user) session.user.id = userId;
      return session;
    },
  },
  events: {
    async signOut({ token }) {
      if (typeof token?.sid === 'string') await prisma.session.deleteMany({ where: { sessionToken: token.sid } });
    },
  },
};
