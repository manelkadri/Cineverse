import 'server-only';
import { NextResponse } from 'next/server';
import { prisma } from './prisma';
import { requireAccount } from './account-api';
import { NOTIFICATION_LIMITS, createRateLimiter, isSafeInternalPath, type NotificationCategory } from './notification-rules';
import type { NotificationDraft } from './notification-events';

const NOTIFICATIONS_DAYS_READ = 90;
const NOTIFICATIONS_DAYS_ANY = 365;

/**
 * Creates one notification for one account. It is deliberately forgiving: a notification must never make the action
 * that caused it fail, so every problem (duplicate event, missing table, database error) ends with `false` and a log
 * line that carries no account data. Returns true only when a new row was stored.
 */
export async function notify(userId: string, draft: NotificationDraft): Promise<boolean> {
  try {
    // INSERT ... ON CONFLICT DO NOTHING: a repeated event is skipped without raising a database error, so a burst of
    // identical events (every blocked PIN attempt, a retried request) costs one cheap statement and never an exception.
    const result = await prisma.notification.createMany({
      data: [{
        userId,
        category: draft.category,
        type: draft.type,
        title: draft.title.slice(0, NOTIFICATION_LIMITS.titleMax),
        message: draft.message.slice(0, NOTIFICATION_LIMITS.messageMax),
        href: isSafeInternalPath(draft.href) ? draft.href : null,
        dedupeKey: draft.dedupeKey.slice(0, 200),
      }],
      skipDuplicates: true,
    });
    if (result.count > 0 && Math.random() < 0.02) await prune();
    return result.count > 0;
  } catch (error) {
    const code = (error as { code?: string }).code;
    console.error(`[notifications] a notification could not be stored (${code ?? 'unexpected error'})`);
    return false;
  }
}

/** Keeps the table bounded: read notifications live 90 days, any notification at most a year. */
async function prune() {
  const day = 24 * 60 * 60 * 1000;
  try {
    await prisma.notification.deleteMany({ where: { OR: [{ readAt: { not: null }, createdAt: { lt: new Date(Date.now() - NOTIFICATIONS_DAYS_READ * day) } }, { createdAt: { lt: new Date(Date.now() - NOTIFICATIONS_DAYS_ANY * day) } }] } });
  } catch { /* housekeeping only */ }
}

const apiLimiter = createRateLimiter(120, 60_000);

/**
 * Gate for the member-facing notification APIs: signed-in account from the session only (never from the URL or body),
 * CSRF check on changes, and a per-account request brake against abuse.
 */
export async function requireNotificationUser(request: Request, { mutation = false }: { mutation?: boolean } = {}) {
  const access = await requireAccount(request, { mutation });
  if ('response' in access) return access;
  const verdict = apiLimiter(access.context.userId);
  if (!verdict.allowed) {
    return { response: NextResponse.json({ error: 'Trop de requêtes. Réessayez dans un instant.', code: 'RATE_LIMITED' }, { status: 429, headers: { 'Retry-After': String(verdict.retryAfterSeconds) } }) };
  }
  return access;
}

/** The JSON answer when the notification tables are not in the database yet or something unexpected happened. */
export function notificationsFailure(error: unknown) {
  const code = (error as { code?: string }).code;
  if (code === 'P2021' || code === 'P2022') return NextResponse.json({ error: 'Les notifications ne sont pas encore activées sur ce serveur.', code: 'NOTIFICATIONS_UNAVAILABLE' }, { status: 503 });
  console.error(`[notifications] request failed (${code ?? 'unexpected error'})`);
  return NextResponse.json({ error: 'Les notifications sont momentanément indisponibles.', code: 'SERVER_ERROR' }, { status: 500 });
}

export const toItem = (row: { id: string; category: string; type: string; title: string; message: string; href: string | null; readAt: Date | null; createdAt: Date }) => ({
  id: row.id,
  category: row.category as NotificationCategory,
  type: row.type,
  title: row.title,
  message: row.message,
  href: isSafeInternalPath(row.href) ? row.href : null,
  read: row.readAt !== null,
  createdAt: row.createdAt.toISOString(),
});
