'use client';
/* eslint-disable @typescript-eslint/no-explicit-any -- reads the JSON documented and tested in support-admin.integration.test.ts */

import React, { useState } from 'react';
import { AUDIT_LABELS, type AuditAction } from '@/lib/support-meta';
import { Card, EmptyBlock, ErrorBlock, LoadingBlock, PageHeader, Pagination, dateTime, fieldClass, useAdminData } from './ui';

const GROUPS = [{ value: '', label: 'Toutes les actions' }, { value: 'ticket.', label: 'Demandes' }, { value: 'kb.', label: 'Base de connaissances' }, { value: 'settings.', label: 'Paramètres' }, { value: 'announcement.', label: 'Annonces' }];

export default function AdminAudit() {
  const [action, setAction] = useState('');
  const [page, setPage] = useState(1);
  const { data, error, loading, reload } = useAdminData<any>(`/api/admin/support/audit?page=${page}${action ? `&action=${encodeURIComponent(action)}` : ''}`);
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  return (
    <>
      <PageHeader title="Journal d’activité" description="Historique des actions de l’équipe. Lecture seule : une entrée ne peut être ni modifiée ni supprimée, et aucune donnée sensible n’y est enregistrée." />
      <label className="mb-4 block max-w-xs text-xs font-semibold text-[#9a9aa3]">Type d’action
        <select value={action} onChange={(event) => { setAction(event.target.value); setPage(1); }} className={`${fieldClass} mt-1`} data-testid="audit-filter">{GROUPS.map((group) => <option key={group.value} value={group.value}>{group.label}</option>)}</select>
      </label>
      {error && <ErrorBlock message={error} onRetry={reload} />}
      {loading && !data && <LoadingBlock />}
      {data && (data.entries.length === 0 ? <EmptyBlock>Aucune action enregistrée.</EmptyBlock> : (
        <Card>
          <ul className="divide-y divide-white/[0.06]" data-testid="audit-list">
            {data.entries.map((entry: any) => (
              <li key={entry.id} className="py-3 text-sm" data-audit={entry.action}>
                <p className="font-semibold">{AUDIT_LABELS[entry.action as AuditAction] ?? entry.action}</p>
                <p className="text-xs text-[#8f8f94]">{entry.actorName} · {entry.resourceType} · <span className="font-mono">{entry.resourceId}</span> · {dateTime.format(new Date(entry.createdAt))}</p>
                {entry.metadata && Object.keys(entry.metadata).length > 0 && <p className="mt-0.5 break-words font-mono text-[11px] text-[#6f6f78]">{Object.entries(entry.metadata).map(([key, value]) => `${key}: ${String(value)}`).join(' · ')}</p>}
              </li>
            ))}
          </ul>
          <Pagination page={page} pages={pages} onChange={setPage} />
        </Card>
      ))}
    </>
  );
}
