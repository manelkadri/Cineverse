'use client';
/* eslint-disable @typescript-eslint/no-explicit-any -- the overview reads the JSON documented and tested in support-admin.integration.test.ts */

import React from 'react';
import Link from 'next/link';
import { Activity, AlertCircle, ArrowRight, CheckCircle2, Clock, Flame, Inbox, LifeBuoy, Lock, MessageCircleWarning } from 'lucide-react';
import { AUDIT_LABELS, priorityLabel, type AuditAction } from '@/lib/support-meta';
import { Card, Distribution, EmptyBlock, ErrorBlock, KpiCard, LoadingBlock, PageHeader, PriorityBadge, StatusBadge, ghostButton, refOf, relativeTime, useAdminData } from './ui';

function TicketRow({ ticket, categories }: { ticket: any; categories: Map<string, string> }) {
  return (
    <li>
      <Link href={`/admin/support/tickets/${ticket.id}`} className="flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-white/[0.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary motion-reduce:transition-none" data-ticket={ticket.reference}>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{ticket.subject}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-[#8f8f94]"><span className="font-mono">{ticket.reference}</span><span>{categories.get(ticket.category) ?? ticket.category}</span><span>{relativeTime(ticket.createdAt)}</span></p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1"><StatusBadge status={ticket.status} /><PriorityBadge priority={ticket.priority} /></div>
      </Link>
    </li>
  );
}

function TicketList({ tickets, categories, empty }: { tickets: any[]; categories: Map<string, string>; empty: string }) {
  return tickets.length === 0 ? <EmptyBlock testId="overview-empty">{empty}</EmptyBlock> : <ul className="-mx-2 divide-y divide-white/[0.05]">{tickets.map((ticket) => <TicketRow key={ticket.id} ticket={ticket} categories={categories} />)}</ul>;
}

export default function AdminOverview() {
  const { data, error, loading, reload } = useAdminData<any>('/api/admin/support/overview');
  if (loading && !data) return <><PageHeader title="Vue d’ensemble" /><LoadingBlock /></>;
  if (error || !data) return <><PageHeader title="Vue d’ensemble" /><ErrorBlock message={error ?? 'Chargement impossible.'} onRetry={reload} /></>;
  const k = data.kpis;
  const categories = new Map<string, string>(data.categories.map((category: any) => [category.id, category.label]));
  return (
    <>
      <PageHeader title="Vue d’ensemble" description="L’état du support, lu directement dans la base de données." actions={<Link href="/admin/support/tickets" className={ghostButton}>Toutes les demandes<ArrowRight size={15} aria-hidden="true" /></Link>} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6" data-testid="kpis">
        <KpiCard label="Total" value={k.total} icon={Inbox} href="/admin/support/tickets" />
        <KpiCard label="Ouvertes" value={k.open} icon={LifeBuoy} href="/admin/support/tickets?status=open" accent={k.open > 0} />
        <KpiCard label="En cours" value={k.in_progress} icon={Clock} href="/admin/support/tickets?status=in_progress" />
        <KpiCard label="Résolues" value={k.resolved} icon={CheckCircle2} href="/admin/support/tickets?status=resolved" />
        <KpiCard label="Fermées" value={k.closed} icon={Lock} href="/admin/support/tickets?status=closed" />
        <KpiCard label="À traiter" value={k.toHandle} hint="Ouvertes ou en cours, sans réponse de l’équipe" icon={MessageCircleWarning} href="/admin/support/tickets?attention=1" accent={k.toHandle > 0} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <Card title="Demandes récentes" action={<Link href="/admin/support/tickets?sort=newest" className="text-xs font-semibold text-primary hover:underline">Voir tout</Link>}><TicketList tickets={data.recent} categories={categories} empty="Aucune demande pour le moment." /></Card>
        <Card title={<span className="flex items-center gap-2"><AlertCircle size={16} className="text-primary" aria-hidden="true" />À traiter</span>} action={<Link href="/admin/support/tickets?attention=1" className="text-xs font-semibold text-primary hover:underline">Voir tout</Link>}><TicketList tickets={data.attention} categories={categories} empty="Rien n’attend de réponse." /></Card>
        <Card title={<span className="flex items-center gap-2"><Flame size={16} className="text-amber-400" aria-hidden="true" />Priorité haute ou urgente</span>}><TicketList tickets={data.highPriority} categories={categories} empty="Aucune demande prioritaire en cours." /></Card>
        <Card title={<span className="flex items-center gap-2"><Activity size={16} className="text-[#8f8f94]" aria-hidden="true" />Activité d’administration récente</span>} action={<Link href="/admin/support/audit" className="text-xs font-semibold text-primary hover:underline">Journal d’audit</Link>}>
          {data.activity.length === 0 ? <EmptyBlock testId="overview-empty">Aucune action enregistrée pour le moment.</EmptyBlock> : (
            <ul className="space-y-3" data-testid="activity">
              {data.activity.map((entry: any) => (
                <li key={entry.id} className="flex items-start gap-3 text-sm"><span aria-hidden="true" className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" /><div className="min-w-0"><p className="font-semibold">{AUDIT_LABELS[entry.action as AuditAction] ?? entry.action}{entry.resourceType === 'ticket' && <span className="ml-2 font-mono text-xs font-normal text-[#8f8f94]">{refOf(entry.resourceId)}</span>}</p><p className="text-xs text-[#8f8f94]">{entry.actorName} · {relativeTime(entry.createdAt)}</p></div></li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Par statut"><Distribution total={k.total} items={[{ key: 'open', label: 'Ouverte', count: k.open }, { key: 'in_progress', label: 'En cours', count: k.in_progress }, { key: 'resolved', label: 'Résolue', count: k.resolved }, { key: 'closed', label: 'Fermée', count: k.closed }].filter((item) => item.count > 0)} empty="Aucune demande." /></Card>
        <Card title="Par catégorie"><Distribution total={k.total} items={data.byCategory.map((row: any) => ({ key: row.category, label: categories.get(row.category) ?? row.category, count: row.count }))} empty="Aucune demande." /></Card>
        <Card title="Par priorité" className="lg:col-span-2"><Distribution total={k.total} items={data.byPriority.sort((a: any, b: any) => ['low', 'normal', 'high', 'urgent'].indexOf(b.priority) - ['low', 'normal', 'high', 'urgent'].indexOf(a.priority)).map((row: any) => ({ key: row.priority, label: priorityLabel(['low', 'normal', 'high', 'urgent'].indexOf(row.priority)), count: row.count }))} empty="Aucune demande." /></Card>
      </div>
    </>
  );
}
