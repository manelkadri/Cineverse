import 'server-only';
import { createHmac } from 'node:crypto';
import { prisma } from './prisma';

const WINDOW_MS = 15 * 60 * 1000;
const MAX_SOURCE_FAILURES = 5; // per email + client address
const MAX_ACCOUNT_FAILURES = 20; // per email across every address (defeats rotating X-Forwarded-For)
const RETENTION_MS = 24 * 60 * 60 * 1000;

export class AuthRateLimitError extends Error {
  constructor(readonly retryAfterSeconds: number) {
    super('Too many authentication attempts');
  }
}

export type AuthIdentity = { sourceHash: string; accountHash: string };

export function authSecret() {
  return process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || '';
}

export function isAuthRuntimeConfigured() {
  return Boolean(process.env.DATABASE_URL && authSecret());
}

function headerValue(headers: Headers | Record<string, string | string[] | undefined>, name: string) {
  if (headers instanceof Headers) return headers.get(name) ?? '';
  const value = headers[name] ?? headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}

export function authIdentity(email: string, headers: Headers | Record<string, string | string[] | undefined>): AuthIdentity {
  const normalized = email.toLowerCase();
  const forwarded = headerValue(headers, 'x-forwarded-for').split(',')[0]?.trim();
  const ip = forwarded || headerValue(headers, 'x-real-ip') || 'unknown';
  const hmac = (value: string) => createHmac('sha256', authSecret()).update(value).digest('hex');
  return { sourceHash: hmac(`${normalized}|${ip}`), accountHash: hmac(`account|${normalized}`) };
}

async function retryAfter(identifierHash: string, limit: number, since: Date, failures: number) {
  // The lock lifts when enough old failures age out of the window to drop below the limit.
  const pivot = await prisma.authAttempt.findFirst({
    where: { identifierHash, success: false, createdAt: { gte: since } },
    orderBy: { createdAt: 'asc' },
    skip: Math.max(0, failures - limit),
    select: { createdAt: true },
  });
  const lifts = (pivot?.createdAt.getTime() ?? Date.now()) + WINDOW_MS;
  return Math.max(1, Math.ceil((lifts - Date.now()) / 1000));
}

export async function enforceAuthRateLimit({ sourceHash, accountHash }: AuthIdentity) {
  const since = new Date(Date.now() - WINDOW_MS);
  const where = (identifierHash: string) => ({ identifierHash, success: false, createdAt: { gte: since } });
  const [sourceFailures, accountFailures] = await Promise.all([
    prisma.authAttempt.count({ where: where(sourceHash) }),
    prisma.authAttempt.count({ where: where(accountHash) }),
  ]);
  if (sourceFailures >= MAX_SOURCE_FAILURES) throw new AuthRateLimitError(await retryAfter(sourceHash, MAX_SOURCE_FAILURES, since, sourceFailures));
  if (accountFailures >= MAX_ACCOUNT_FAILURES) throw new AuthRateLimitError(await retryAfter(accountHash, MAX_ACCOUNT_FAILURES, since, accountFailures));
}

export async function recordAuthAttempt({ sourceHash, accountHash }: AuthIdentity, success: boolean) {
  await prisma.authAttempt.createMany({ data: [{ identifierHash: sourceHash, success }, { identifierHash: accountHash, success }] });
  if (success) await prisma.authAttempt.deleteMany({ where: { identifierHash: { in: [sourceHash, accountHash] }, success: false } });
  // Keep the table bounded: occasionally drop rows older than the retention period.
  if (Math.random() < 0.02) await prisma.authAttempt.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - RETENTION_MS) } } });
}
