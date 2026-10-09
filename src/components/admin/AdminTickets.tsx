'use client';
/* eslint-disable @typescript-eslint/no-explicit-any -- the ticket list reads the JSON documented and tested in support-admin.integration.test.ts */

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { MessageCircleWarning, Search, UserRound, X } from 'lucide-react';
import { SUPPORT_PRIORITIES } from '@/lib/support-meta';
import { SUPPORT_STATUSES } from '@/lib/support-rules';
import { Card, EmptyBlock, ErrorBlock, LoadingBlock, PageHeader, Pagination, PriorityBadge, StatusBadge, fieldClass, ghostButton, relativeTime, useAdminData } from './ui';

const FILTER_KEYS = ['q', 'status', 'category', 'priority', 'assignee', 'attention', 'from', 'to', 'sort', 'page'] as const;

export default function AdminTickets() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const query = useMemo(() => {
    const next = new URLSearchParams();
    for (const key of FILTER_KEYS) { const value = params.get(key); if (value) next.set(key, value); }
    return next;
  }, [params]);
  const [search, setSearch] = useState(params.get('q') ?? '');

  const apply = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(query);
    for (const [key, value] of Object.entries(changes)) { if (value) next.set(key, value); else next.delete(key); }
    if (!('page' in changes)) next.delete('page');
    router.replace(`${pathname}${next.size ? `?${next}` : ''}`, { scroll: false });
  };

  // typing in the search box updates the address after a short pause
  useEffect(() => {
    if (search.trim() === (params.get('q') ?? '')) return;
    const timer = window.setTimeout(() => apply({ q: search.trim() || null }), 350);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const { data, error, loading, reload } = useAdminData<any>(`/api/admin/support/tickets?${query}`);
  const categories = useAdminData<any>('/api/admin/support/categories');
  const staff = useAdminData<any>('/api/admin/support/staff');
  const categoryName = useMemo(() => new Map<string, string>((categories.data?.categories ?? []).map((category: any) => [category.id, category.label])), [categories.data]);
  const staffName = useMemo(() => new Map<string, string>((staff.data?.staff ?? []).map((member: any) => [member.id, member.name])), [staff.data]);

  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const page = Number(query.get('page') ?? '1') || 1;
  const filtered = FILTER_KEYS.some((key) => key !== 'sort' && key !== 'page' && query.get(key));
  const reset = () => { setSearch(''); router.replace(pathname, { scroll: false }); };

  return (
    <>
      <PageHeader title="Demandes d’aide" description="Recherchez, filtrez et traitez les demandes." />

      <Card className="mb-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="relative sm:col-span-2">
            <span className="sr-only">Rechercher par référence, sujet ou e-mail</span>
            <Search size={16} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#6f6f78]" />
            <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Référence, sujet ou e-mail…" maxLength={100} data-testid="ticket-search" className={`${fieldClass} pl-9`} />
          </label>
          <select aria-label="Statut" value={query.get('status') ?? ''} onChange={(event) => apply({ status: event.target.value || null })} className={fieldClass}>
            <option value="">Tous les statuts</option>{SUPPORT_STATUSES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
          <select aria-label="Catégorie" value={query.get('category') ?? ''} onChange={(event) => apply({ category: event.target.value || null })} className={fieldClass}>
            <option value="">Toutes les catégories</option>{(categories.data?.categories ?? []).map((item: any) => <option key={item.id} value={item.id}>{item.label}{item.enabled ? '' : ' (désactivée)'}</option>)}
          </select>
          <select aria-label="Priorité" value={query.get('priority') ?? ''} onChange={(event) => apply({ priority: event.target.value || null })} className={fieldClass}>
            <option value="">Toutes les priorités</option>{SUPPORT_PRIORITIES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
          <select aria-label="Assigné à" value={query.get('assignee') ?? ''} onChange={(event) => apply({ assignee: event.target.value || null })} className={fieldClass}>
            <option value="">Tous les responsables</option><option value="me">Assignées à moi</option><option value="unassigned">Non assignées</option>
            {(staff.data?.staff ?? []).map((member: any) => <option key={member.id} value={member.id}>{member.name}</option>)}
          </select>
          <label className="flex items-center gap-2 text-xs text-[#9a9aa3]"><span className="shrink-0">Du</span><input type="date" aria-label="Date de début" value={query.get('from') ?? ''} onChange={(event) => apply({ from: event.target.value || null })} className={fieldClass} /></label>
          <label className="flex items-center gap-2 text-xs text-[#9a9aa3]"><span className="shrink-0">au</span><input type="date" aria-label="Date de fin" value={query.get('to') ?? ''} onChange={(event) => apply({ to: event.target.value || null })} className={fieldClass} /></label>
          <select aria-label="Tri" value={query.get('sort') ?? 'newest'} onChange={(event) => apply({ sort: event.target.value === 'newest' ? null : event.target.value })} className={fieldClass}>
            <option value="newest">Plus récentes</option><option value="oldest">Plus anciennes</option><option value="priority">Priorité</option><option value="updated">Dernière mise à jour</option>
          </select>
          <button type="button" aria-pressed={query.get('attention') === '1'} onClick={() => apply({ attention: query.get('attention') === '1' ? null : '1' })} className={`${ghostButton} ${query.get('attention') === '1' ? 'border-primary text-white' : ''}`}><MessageCircleWarning size={15} aria-hidden="true" />À traiter</button>
          {filtered && <button type="button" onClick={reset} className={ghostButton} data-testid="reset-filters"><X size={15} aria-hidden="true" />Réinitialiser</button>}
        </div>
      </Card>

      {error && <ErrorBlock message={error} onRetry={reload} />}
      {loading && !data && <LoadingBlock />}
      {data && (
        <div aria-busy={loading}>
          <p className="mb-3 text-sm text-[#9a9aa3]" role="status" data-testid="ticket-count">{data.total} demande{data.total > 1 ? 's' : ''}{filtered ? ' correspondante' + (data.total > 1 ? 's' : '') : ''}</p>
          {data.tickets.length === 0 ? <EmptyBlock>{filtered ? 'Aucune demande ne correspond à ces critères.' : 'Aucune demande pour le moment.'}</EmptyBlock> : (
            <>
              <div className="hidden overflow-hidden rounded-2xl border border-white/[0.08] bg-[#17191F] md:block">
                <table className="w-full table-fixed text-left text-sm" data-testid="ticket-table">
                  <thead className="bg-white/[0.03] text-xs uppercase tracking-wider text-[#8f8f94]"><tr><th scope="col" className="w-28 px-4 py-3 font-semibold">Réf.</th><th scope="col" className="px-4 py-3 font-semibold">Sujet</th><th scope="col" className="hidden w-36 px-4 py-3 font-semibold xl:table-cell">Catégorie</th><th scope="col" className="w-28 px-4 py-3 font-semibold">Statut</th><th scope="col" className="w-28 px-4 py-3 font-semibold">Priorité</th><th scope="col" className="hidden w-36 px-4 py-3 font-semibold lg:table-cell">Assignée à</th><th scope="col" className="w-28 px-4 py-3 font-semibold">Mise à jour</th></tr></thead>
                  <tbody className="divide-y divide-white/[0.06]">
                    {data.tickets.map((ticket: any) => (
                      <tr key={ticket.id} data-ticket={ticket.reference} className="transition-colors hover:bg-white/[0.03] motion-reduce:transition-none">
                        <td className="px-4 py-3 font-mono text-xs text-[#9a9aa3]">{ticket.reference}</td>
                        <td className="px-4 py-3"><Link href={`/admin/support/tickets/${ticket.id}`} className="block truncate font-semibold hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">{ticket.awaitingStaff && ['open', 'in_progress'].includes(ticket.status) && <span title="Sans réponse de l’équipe" aria-label="Sans réponse de l’équipe" className="mr-2 inline-block size-1.5 rounded-full bg-primary align-middle" />}{ticket.subject}</Link><p className="truncate text-xs text-[#8f8f94]">{ticket.preview}</p></td>
                        <td className="hidden truncate px-4 py-3 text-[#b7b7bd] xl:table-cell">{categoryName.get(ticket.category) ?? ticket.category}</td>
                        <td className="px-4 py-3"><StatusBadge status={ticket.status} /></td>
                        <td className="px-4 py-3"><PriorityBadge priority={ticket.priority} /></td>
                        <td className="hidden truncate px-4 py-3 text-[#b7b7bd] lg:table-cell">{ticket.assignedTo ? ticket.assignedTo.name : <span className="text-[#6f6f78]">—</span>}</td>
                        <td className="px-4 py-3 text-xs text-[#8f8f94]">{relativeTime(ticket.updatedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <ul className="space-y-3 md:hidden" data-testid="ticket-cards">
                {data.tickets.map((ticket: any) => (
                  <li key={ticket.id} data-ticket={ticket.reference}>
                    <Link href={`/admin/support/tickets/${ticket.id}`} className="block rounded-2xl border border-white/[0.08] bg-[#17191F] p-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
                      <div className="flex items-start justify-between gap-2"><span className="font-mono text-xs text-[#8f8f94]">{ticket.reference}</span><StatusBadge status={ticket.status} /></div>
                      <p className="mt-1.5 font-semibold">{ticket.subject}</p>
                      <p className="mt-1 line-clamp-2 text-xs text-[#8f8f94]">{ticket.preview}</p>
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-[#8f8f94]"><PriorityBadge priority={ticket.priority} /><span className="flex items-center gap-1"><UserRound size={12} aria-hidden="true" />{ticket.assignedTo ? ticket.assignedTo.name : staffName.size ? 'Non assignée' : '—'}</span><span>{relativeTime(ticket.updatedAt)}</span></div>
                    </Link>
                  </li>
                ))}
              </ul>
              <Pagination page={page} pages={pages} onChange={(next) => apply({ page: next > 1 ? String(next) : null })} />
            </>
          )}
        </div>
      )}
    </>
  );
}
