'use client';
/* eslint-disable @typescript-eslint/no-explicit-any -- the administration reads JSON response bodies whose shape the API tests pin down */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Inbox, Loader2, RefreshCw } from 'lucide-react';
import { SUPPORT_STATUSES, ticketReference } from '@/lib/support-rules';
import { SUPPORT_PRIORITIES } from '@/lib/support-meta';

// Shared building blocks of the support administration: data loading, cards, badges, charts and the standard
// loading, empty and error states.

export interface ApiResult<T = any> { status: number; ok: boolean; body: T }

export async function adminFetch<T = any>(path: string, options: { method?: string; json?: unknown } = {}): Promise<ApiResult<T>> {
  try {
    const method = options.method ?? 'GET';
    // the server refuses a state-changing request that is not JSON, so an action with no data (for example "mark all as read") sends {}
    const payload = options.json === undefined && method !== 'GET' && method !== 'DELETE' ? {} : options.json;
    const response = await fetch(path, { method, headers: payload === undefined ? undefined : { 'Content-Type': 'application/json' }, body: payload === undefined ? undefined : JSON.stringify(payload), cache: 'no-store' });
    const body = await response.json().catch(() => ({}));
    if (response.status === 401) window.location.assign(`/login?callbackUrl=${encodeURIComponent(window.location.pathname)}`);
    return { status: response.status, ok: response.ok, body };
  } catch {
    return { status: 0, ok: false, body: { error: 'Connexion impossible. Vérifiez votre réseau et réessayez.' } as T };
  }
}

/** Loads a GET endpoint; `reload` fetches again, and changing `path` loads the new address. */
export function useAdminData<T = any>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(path));
  const current = useRef(path);
  current.current = path;
  const load = useCallback(async () => {
    if (!path) return;
    setLoading(true);
    const result = await adminFetch<T>(path);
    if (current.current !== path) return; // a newer request replaced this one
    if (result.ok) { setData(result.body); setError(null); }
    else {
      const message = (result.body as { error?: string }).error;
      setError(result.status === 404 ? message ?? 'Cette page n’est plus accessible avec ce compte.' : result.status === 503 ? 'Le service est momentanément indisponible. Réessayez dans un instant.' : message ?? 'Chargement impossible.');
    }
    setLoading(false);
  }, [path]);
  useEffect(() => { void load(); }, [load]);
  return { data, error, loading, reload: load, setData };
}

export const dateTime = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
export const dateOnly = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
const relativeFormat = new Intl.RelativeTimeFormat('fr', { numeric: 'auto' });
export function relativeTime(iso: string, now = Date.now()) {
  const seconds = Math.round((new Date(iso).getTime() - now) / 1000);
  const abs = Math.abs(seconds);
  if (abs < 45) return 'à l’instant';
  if (abs < 3600) return relativeFormat.format(Math.round(seconds / 60), 'minute');
  if (abs < 86400) return relativeFormat.format(Math.round(seconds / 3600), 'hour');
  if (abs < 86400 * 30) return relativeFormat.format(Math.round(seconds / 86400), 'day');
  return dateOnly.format(new Date(iso));
}
export function duration(seconds: number) {
  if (seconds < 90) return `${Math.round(seconds)} s`;
  if (seconds < 5400) return `${Math.round(seconds / 60)} min`;
  if (seconds < 172800) return `${(seconds / 3600).toFixed(1).replace('.', ',')} h`;
  return `${(seconds / 86400).toFixed(1).replace('.', ',')} j`;
}
export const refOf = ticketReference;

export const fieldClass = 'w-full rounded-lg border border-white/10 bg-[#0d0f13] px-3 py-2 text-sm text-white placeholder:text-[#6f6f78] transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/25 disabled:opacity-60';
export const primaryButton = 'inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-primary-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-not-allowed disabled:opacity-45';
export const ghostButton = 'inline-flex items-center justify-center gap-2 rounded-lg border border-white/15 px-3.5 py-2 text-sm font-semibold text-[#d7d7da] transition-colors hover:border-white/40 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary disabled:cursor-not-allowed disabled:opacity-45';

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-[#9a9aa3]">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ title, action, children, className = '', id }: { title?: React.ReactNode; action?: React.ReactNode; children: React.ReactNode; className?: string; id?: string }) {
  return (
    <section id={id} aria-label={typeof title === 'string' ? title : undefined} className={`min-w-0 rounded-2xl border border-white/[0.08] bg-[#17191F] p-4 sm:p-5 ${className}`}>
      {(title || action) && (
        <div className="mb-4 flex items-center justify-between gap-3">
          {title && <h2 className="text-base font-bold">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function KpiCard({ label, value, hint, icon: Icon, accent = false, href }: { label: string; value: React.ReactNode; hint?: string; icon: React.ComponentType<{ size?: number; className?: string }>; accent?: boolean; href?: string }) {
  const body = (
    <div className={`h-full rounded-2xl border bg-[#17191F] p-4 transition-colors duration-300 motion-reduce:transition-none ${accent ? 'border-primary/40' : 'border-white/[0.08]'} ${href ? 'hover:border-primary/50' : ''}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-[#8f8f94]">{label}</p>
        <Icon size={16} className={accent ? 'text-primary' : 'text-[#6f6f78]'} />
      </div>
      <p className="mt-2 text-3xl font-extrabold tabular-nums" data-kpi={label}>{value}</p>
      {hint && <p className="mt-1 text-xs text-[#8f8f94]">{hint}</p>}
    </div>
  );
  return href ? <a href={href} className="block focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">{body}</a> : body;
}

const STATUS_STYLE: Record<string, string> = {
  open: 'border-primary/40 bg-primary/10 text-red-200',
  in_progress: 'border-amber-400/30 bg-amber-400/10 text-amber-200',
  resolved: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200',
  closed: 'border-white/15 bg-white/[0.05] text-[#b7b7bd]',
};
export const statusLabel = (id: string) => SUPPORT_STATUSES.find((item) => item.id === id)?.label ?? id;
export function StatusBadge({ status }: { status: string }) {
  return <span data-status={status} className={`inline-flex whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${STATUS_STYLE[status] ?? STATUS_STYLE.closed}`}>{statusLabel(status)}</span>;
}

// Neutral by default; only the two upper levels get a colour, and only "urgent" is strong.
const PRIORITY_STYLE: Record<string, string> = {
  low: 'text-[#8f8f94]',
  normal: 'text-[#b7b7bd]',
  high: 'font-semibold text-amber-300',
  urgent: 'font-bold text-red-300',
};
export const priorityText = (id: string) => SUPPORT_PRIORITIES.find((item) => item.id === id)?.label ?? id;
export function PriorityBadge({ priority }: { priority: string }) {
  return (
    <span data-priority={priority} className={`inline-flex items-center gap-1.5 text-xs ${PRIORITY_STYLE[priority] ?? PRIORITY_STYLE.normal}`}>
      <span aria-hidden="true" className={`size-1.5 rounded-full ${priority === 'urgent' ? 'bg-red-500' : priority === 'high' ? 'bg-amber-400' : priority === 'low' ? 'bg-[#4a4a52]' : 'bg-[#8f8f94]'}`} />
      {priorityText(priority)}
    </span>
  );
}

export function LoadingBlock({ label = 'Chargement…' }: { label?: string }) {
  return <div role="status" className="flex items-center gap-2 py-8 text-sm text-[#9a9aa3]"><Loader2 size={16} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />{label}</div>;
}
export function ErrorBlock({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" data-testid="admin-error" className="flex flex-wrap items-center gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-100">
      <AlertTriangle size={17} className="shrink-0" aria-hidden="true" /><span className="min-w-0 flex-1">{message}</span>
      {onRetry && <button type="button" onClick={onRetry} className={ghostButton}><RefreshCw size={14} aria-hidden="true" />Réessayer</button>}
    </div>
  );
}
export function EmptyBlock({ children, testId = 'admin-empty' }: { children: React.ReactNode; testId?: string }) {
  return <div data-testid={testId} className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-[#8f8f94]"><Inbox size={22} className="text-[#5f5f68]" aria-hidden="true" />{children}</div>;
}

/** Horizontal bars for a distribution. The numbers are printed, so the bars are never the only source of information. */
export function Distribution({ items, total, empty = 'Aucune donnée.' }: { items: { key: string; label: React.ReactNode; count: number }[]; total: number; empty?: string }) {
  if (total === 0 || items.length === 0) return <p className="text-sm text-[#8f8f94]">{empty}</p>;
  return (
    <ul className="space-y-2.5">
      {items.map((item) => (
        <li key={item.key} data-bar={item.key}>
          <div className="flex items-baseline justify-between gap-3 text-sm"><span className="min-w-0 truncate">{item.label}</span><span className="shrink-0 tabular-nums text-[#b7b7bd]">{item.count} <span className="text-[#6f6f78]">({Math.round((item.count / total) * 100)} %)</span></span></div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/[0.06]" aria-hidden="true"><div className="h-full rounded-full bg-primary/80" style={{ width: `${Math.max(2, (item.count / total) * 100)}%` }} /></div>
        </li>
      ))}
    </ul>
  );
}

/** A column chart in plain SVG. A hidden table gives screen readers the same numbers. */
export function ColumnChart({ points, label }: { points: { date: string; count: number }[]; label: string }) {
  const max = Math.max(1, ...points.map((point) => point.count));
  const width = 600;
  const height = 160;
  const gap = points.length > 60 ? 1 : 3;
  const bar = Math.max(1, (width - gap * (points.length - 1)) / Math.max(1, points.length));
  return (
    <div>
      <svg role="img" aria-label={label} viewBox={`0 0 ${width} ${height + 20}`} className="h-auto w-full" preserveAspectRatio="none" data-testid="column-chart">
        {points.map((point, index) => {
          const h = (point.count / max) * height;
          return <rect key={point.date} x={index * (bar + gap)} y={height - h} width={bar} height={Math.max(point.count > 0 ? 2 : 0, h)} rx={1.5} className="fill-primary/80"><title>{`${point.date} : ${point.count}`}</title></rect>;
        })}
        <line x1="0" x2={width} y1={height + 0.5} y2={height + 0.5} className="stroke-white/15" />
      </svg>
      <div className="mt-1 flex justify-between text-[11px] text-[#6f6f78]"><span>{points[0]?.date}</span><span>maximum : {max}</span><span>{points[points.length - 1]?.date}</span></div>
      <table className="sr-only"><caption>{label}</caption><thead><tr><th>Date</th><th>Demandes</th></tr></thead><tbody>{points.map((point) => <tr key={point.date}><td>{point.date}</td><td>{point.count}</td></tr>)}</tbody></table>
    </div>
  );
}

export function Pagination({ page, pages, onChange }: { page: number; pages: number; onChange: (page: number) => void }) {
  if (pages <= 1) return null;
  return (
    <nav aria-label="Pagination" className="mt-5 flex items-center justify-center gap-3 text-sm">
      <button type="button" onClick={() => onChange(page - 1)} disabled={page <= 1} className={ghostButton}>Précédent</button>
      <span className="tabular-nums text-[#9a9aa3]">Page {page} / {pages}</span>
      <button type="button" onClick={() => onChange(page + 1)} disabled={page >= pages} className={ghostButton}>Suivant</button>
    </nav>
  );
}
