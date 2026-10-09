'use client';
/* eslint-disable @typescript-eslint/no-explicit-any -- reads the JSON documented and tested in support-admin.integration.test.ts */

import React, { useState } from 'react';
import { CheckCircle2, Clock, Inbox, Timer } from 'lucide-react';
import { Card, ColumnChart, Distribution, ErrorBlock, KpiCard, LoadingBlock, PageHeader, dateOnly, duration, fieldClass, priorityText, statusLabel, useAdminData } from './ui';

const dayString = (offset: number) => new Date(Date.now() - offset * 86_400_000).toISOString().slice(0, 10);
const PRESETS = [{ label: '7 jours', days: 6 }, { label: '30 jours', days: 29 }, { label: '90 jours', days: 89 }];

export default function AdminAnalytics() {
  const [from, setFrom] = useState(dayString(29));
  const [to, setTo] = useState(dayString(0));
  const [granularity, setGranularity] = useState<'day' | 'week' | 'month'>('day');
  const { data, error, loading, reload } = useAdminData<any>(`/api/admin/support/analytics?from=${from}&to=${to}&granularity=${granularity}`);
  const labels = new Map<string, string>((data?.categories ?? []).map((category: any) => [category.id, category.label]));

  const metric = (value: any, icon: any, label: string, unavailable: string) => (
    <KpiCard label={label} icon={icon} value={value.available ? duration(value.seconds) : '—'} hint={value.available ? `Moyenne sur ${value.sample} demande${value.sample > 1 ? 's' : ''}` : unavailable} />
  );

  return (
    <>
      <PageHeader title="Statistiques" description="Calculées à partir des demandes réellement enregistrées. Une mesure indisponible est indiquée comme telle, jamais estimée." />
      <Card className="mb-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex gap-1" role="group" aria-label="Périodes prédéfinies">
            {PRESETS.map((preset) => <button key={preset.days} type="button" onClick={() => { setFrom(dayString(preset.days)); setTo(dayString(0)); }} className="rounded-full border border-white/15 px-3 py-1.5 text-xs font-bold text-[#d7d7da] hover:border-white/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">{preset.label}</button>)}
          </div>
          <label className="text-xs font-semibold text-[#9a9aa3]">Du<input type="date" value={from} max={to} onChange={(event) => event.target.value && setFrom(event.target.value)} className={`${fieldClass} mt-1`} data-testid="range-from" /></label>
          <label className="text-xs font-semibold text-[#9a9aa3]">Au<input type="date" value={to} min={from} max={dayString(0)} onChange={(event) => event.target.value && setTo(event.target.value)} className={`${fieldClass} mt-1`} data-testid="range-to" /></label>
          <label className="text-xs font-semibold text-[#9a9aa3]">Regroupement
            <select value={granularity} onChange={(event) => setGranularity(event.target.value as 'day' | 'week' | 'month')} className={`${fieldClass} mt-1`}><option value="day">Par jour</option><option value="week">Par semaine</option><option value="month">Par mois</option></select>
          </label>
        </div>
      </Card>
      {error && <ErrorBlock message={error} onRetry={reload} />}
      {loading && !data && <LoadingBlock />}
      {data && (
        <div aria-busy={loading} className="space-y-4" data-testid="analytics">
          <p className="text-sm text-[#9a9aa3]">Du {dateOnly.format(new Date(`${data.range.from}T12:00:00Z`))} au {dateOnly.format(new Date(`${data.range.to}T12:00:00Z`))}</p>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiCard label="Demandes reçues" value={data.total} icon={Inbox} accent />
            <KpiCard label="Résolues ou fermées" value={data.resolvedVersusUnresolved.resolved} icon={CheckCircle2} hint={`${data.resolvedVersusUnresolved.unresolved} encore en cours`} />
            {metric(data.firstResponse, Timer, 'Première réponse', 'Aucune réponse enregistrée sur la période')}
            {metric(data.resolution, Clock, 'Délai de résolution', 'Indisponible : aucune résolution enregistrée sur la période')}
          </div>
          <Card title="Demandes dans le temps">{data.total === 0 ? <p className="text-sm text-[#8f8f94]">Aucune demande sur cette période.</p> : <ColumnChart points={data.series} label="Nombre de demandes par période" />}</Card>
          <div className="grid gap-4 lg:grid-cols-3">
            <Card title="Par catégorie"><Distribution total={data.total} items={data.byCategory.map((row: any) => ({ key: row.category, label: labels.get(row.category) ?? row.category, count: row.count }))} /></Card>
            <Card title="Par statut"><Distribution total={data.total} items={Object.entries(data.byStatus).map(([key, count]) => ({ key, label: statusLabel(key), count: count as number }))} /></Card>
            <Card title="Par priorité"><Distribution total={data.total} items={data.byPriority.map((row: any) => ({ key: row.priority, label: priorityText(row.priority), count: row.count }))} /></Card>
          </div>
          <p className="text-xs text-[#6f6f78]">Le délai de résolution ne compte que les demandes dont le passage à « Résolue » ou « Fermée » figure dans le journal d’audit.</p>
        </div>
      )}
    </>
  );
}
