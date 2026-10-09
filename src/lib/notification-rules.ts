// Shared, client-safe rules for the notification center. The server applies them when it creates and returns
// notifications, and the browser re-applies the destination check before it navigates (defence in depth).

/** security and support are essential (always delivered); catalogue and service are announcements a member can switch off. */
export const NOTIFICATION_CATEGORIES = ['security', 'support', 'catalogue', 'service'] as const;
export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];

export const ANNOUNCEMENT_CATEGORIES = ['catalogue', 'service'] as const;
export type AnnouncementCategory = (typeof ANNOUNCEMENT_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<NotificationCategory, string> = {
  security: 'Sécurité',
  support: 'Support',
  catalogue: 'Catalogue',
  service: 'Service',
};

export const NOTIFICATION_LIMITS = { titleMax: 120, messageMax: 400, hrefMax: 200, pageDefault: 15, pageMax: 30 } as const;

/**
 * A destination is safe when it is a path inside CINEVERSE: one leading slash, no second slash (which would mean another
 * site), no scheme, no backslash, no control character or whitespace. External addresses can never be stored or followed.
 */
export function isSafeInternalPath(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0 || value.length > NOTIFICATION_LIMITS.hrefMax) return false;
  if (!value.startsWith('/') || value.startsWith('//')) return false;
  if (/[\\\u0000- \u007F]/.test(value)) return false;
  if (/^\/[^?#]*:/.test(value)) return false; // "/javascript:..." style tricks inside the path
  return /^\/[A-Za-z0-9\-._~/%?=&#+@]*$/.test(value);
}

export interface NotificationItem {
  id: string;
  category: NotificationCategory;
  type: string;
  title: string;
  message: string;
  href: string | null;
  read: boolean;
  createdAt: string;
}

const relative = new Intl.RelativeTimeFormat('fr', { numeric: 'auto' });

/** "il y a 5 minutes", "hier", "il y a 3 jours"; older than a month falls back to the date. */
export function formatRelativeTime(iso: string, now = Date.now()) {
  const seconds = Math.round((new Date(iso).getTime() - now) / 1000);
  const abs = Math.abs(seconds);
  if (abs < 45) return 'à l’instant';
  if (abs < 3600) return relative.format(Math.round(seconds / 60), 'minute');
  if (abs < 86400) return relative.format(Math.round(seconds / 3600), 'hour');
  if (abs < 86400 * 30) return relative.format(Math.round(seconds / 86400), 'day');
  return new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(iso));
}

/** Cursor for newest-first pagination: the last item's time and id, so ties never skip or repeat an item. */
export const encodeCursor = (createdAt: Date, id: string) => `${createdAt.toISOString()}_${id}`;
export function decodeCursor(cursor: string | null | undefined) {
  if (!cursor) return null;
  const separator = cursor.indexOf('_');
  if (separator < 0) return null;
  const createdAt = new Date(cursor.slice(0, separator));
  const id = cursor.slice(separator + 1);
  return Number.isNaN(createdAt.getTime()) || !/^[A-Za-z0-9]{10,40}$/.test(id) ? null : { createdAt, id };
}

/** A small in-memory sliding window per key. It is a best-effort brake on one server instance, not a quota. */
export function createRateLimiter(max: number, windowMs: number) {
  const hits = new Map<string, number[]>();
  return (key: string, now = Date.now()) => {
    const recent = (hits.get(key) ?? []).filter((time) => now - time < windowMs);
    if (recent.length >= max) {
      hits.set(key, recent);
      return { allowed: false as const, retryAfterSeconds: Math.max(1, Math.ceil((recent[0] + windowMs - now) / 1000)) };
    }
    recent.push(now);
    hits.set(key, recent);
    if (hits.size > 5000) for (const [stored, times] of hits) if (times.every((time) => now - time >= windowMs)) hits.delete(stored);
    return { allowed: true as const, retryAfterSeconds: 0 };
  };
}
