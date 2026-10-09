'use client';
/* eslint-disable @typescript-eslint/no-explicit-any -- reads the JSON documented and tested in support-admin.integration.test.ts */

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowDown, ArrowUp, History, Plus } from 'lucide-react';
import { Card, ErrorBlock, LoadingBlock, PageHeader, adminFetch, fieldClass, ghostButton, primaryButton, useAdminData } from './ui';

const PREFS = [
  { key: 'notifyNewTicket', label: 'Nouvelle demande' },
  { key: 'notifyUserReply', label: 'Réponse d’un membre' },
  { key: 'notifyHighPriority', label: 'Demande urgente ou de haute priorité' },
  { key: 'notifyAssigned', label: 'Demande qui m’est assignée' },
  { key: 'notifyReopened', label: 'Demande rouverte' },
] as const;

export default function AdminSettings() {
  const settings = useAdminData<any>('/api/admin/support/settings');
  const staff = useAdminData<any>('/api/admin/support/staff');
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [availability, setAvailability] = useState({ enabled: false, text: '' });
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [newCategory, setNewCategory] = useState({ id: '', label: '' });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!settings.data) return;
    setAvailability((current) => (current.text === '' && !current.enabled ? { enabled: Boolean(settings.data.availability?.enabled), text: settings.data.availability?.text ?? '' } : current));
    setLabels((current) => (Object.keys(current).length ? current : Object.fromEntries(settings.data.categories.map((category: any) => [category.id, category.label]))));
  }, [settings.data]);

  const act = async (path: string, method: string, json: unknown, success: string) => {
    setBusy(true); setNotice(null);
    const result = await adminFetch(path, { method, json });
    setBusy(false);
    if (!result.ok) { setNotice({ ok: false, text: result.body.error ?? 'Enregistrement impossible.' }); return false; }
    setNotice({ ok: true, text: success });
    await settings.reload();
    return true;
  };

  if (settings.loading && !settings.data) return <LoadingBlock />;
  if (settings.error || !settings.data) return <ErrorBlock message={settings.error ?? 'Chargement impossible.'} onRetry={settings.reload} />;
  const { categories, preferences } = settings.data;

  return (
    <>
      <PageHeader title="Paramètres" description="Équipe, catégories du formulaire de contact, disponibilité et vos préférences de notification."
        actions={<Link href="/admin/support/audit" className={ghostButton}><History size={15} aria-hidden="true" />Journal d’activité</Link>} />
      {notice && <p role={notice.ok ? 'status' : 'alert'} data-testid="settings-notice" className={`mb-4 text-sm ${notice.ok ? 'text-emerald-300' : 'text-red-300'}`}>{notice.text}</p>}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Équipe de support">
          {staff.data ? (
            <ul className="divide-y divide-white/[0.06] text-sm" data-testid="staff-list">
              {staff.data.staff.map((member: any) => (
                <li key={member.id} className="flex items-center justify-between gap-3 py-2.5"><span className="min-w-0"><span className="block truncate font-semibold">{member.name}{member.you ? ' (vous)' : ''}</span><span className="block truncate text-xs text-[#8f8f94]">{member.email}</span></span><span className="shrink-0 text-xs text-[#9a9aa3]">{member.openAssigned} en cours</span></li>
              ))}
            </ul>
          ) : <LoadingBlock />}
          <p className="mt-3 text-xs leading-relaxed text-[#8f8f94]">Cette liste est en lecture seule. Les droits d’administration ne peuvent pas être accordés depuis l’interface : ils sont attribués par le propriétaire du site avec le script <code className="break-all rounded bg-white/10 px-1">scripts/grant-support-admin.mjs</code>.</p>
        </Card>

        <Card title="Mes notifications">
          <ul className="space-y-2.5">
            {PREFS.map((pref) => (
              <li key={pref.key}>
                <label className="flex cursor-pointer items-center justify-between gap-3 text-sm">
                  <span>{pref.label}</span>
                  <input type="checkbox" role="switch" checked={Boolean(preferences[pref.key])} disabled={busy} onChange={(event) => act('/api/admin/support/settings/preferences', 'PUT', { [pref.key]: event.target.checked }, 'Préférence enregistrée.')} className="size-4 accent-[#E50914]" data-pref={pref.key} />
                </label>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-[#8f8f94]">Ces choix ne concernent que votre compte.</p>
        </Card>

        <Card title="Catégories du formulaire de contact" className="lg:col-span-2">
          <ul className="space-y-2" data-testid="category-list">
            {categories.map((category: any, index: number) => (
              <li key={category.id} data-category={category.id} className="flex flex-wrap items-center gap-2">
                <input aria-label={`Libellé de la catégorie ${category.id}`} value={labels[category.id] ?? category.label} maxLength={40} onChange={(event) => setLabels({ ...labels, [category.id]: event.target.value })} className={`${fieldClass} max-w-xs`} />
                <button type="button" disabled={busy || (labels[category.id] ?? category.label) === category.label} onClick={() => act(`/api/admin/support/categories/${encodeURIComponent(category.id)}`, 'PATCH', { label: labels[category.id] }, 'Catégorie renommée.')} className={ghostButton} data-action="rename">Renommer</button>
                <label className="flex items-center gap-2 text-xs text-[#b7b7bd]"><input type="checkbox" checked={category.enabled} disabled={busy} onChange={(event) => act(`/api/admin/support/categories/${encodeURIComponent(category.id)}`, 'PATCH', { enabled: event.target.checked }, event.target.checked ? 'Catégorie activée.' : 'Catégorie désactivée.')} className="size-4 accent-[#E50914]" data-action="toggle" />Active</label>
                <button type="button" aria-label={`Monter ${category.label}`} disabled={busy || index === 0} onClick={() => act(`/api/admin/support/categories/${encodeURIComponent(category.id)}`, 'PATCH', { move: 'up' }, 'Ordre enregistré.')} className={ghostButton}><ArrowUp size={14} aria-hidden="true" /></button>
                <button type="button" aria-label={`Descendre ${category.label}`} disabled={busy || index === categories.length - 1} onClick={() => act(`/api/admin/support/categories/${encodeURIComponent(category.id)}`, 'PATCH', { move: 'down' }, 'Ordre enregistré.')} className={ghostButton}><ArrowDown size={14} aria-hidden="true" /></button>
              </li>
            ))}
          </ul>
          <form className="mt-4 flex flex-wrap items-end gap-2" noValidate onSubmit={async (event) => { event.preventDefault(); if (await act('/api/admin/support/categories', 'POST', newCategory, 'Catégorie ajoutée.')) { setNewCategory({ id: '', label: '' }); setLabels({}); } }}>
            <label className="text-xs font-semibold text-[#9a9aa3]">Identifiant<input value={newCategory.id} maxLength={30} onChange={(event) => setNewCategory({ ...newCategory, id: event.target.value.toLowerCase() })} placeholder="facturation" className={`${fieldClass} mt-1`} data-testid="category-id" /></label>
            <label className="text-xs font-semibold text-[#9a9aa3]">Libellé<input value={newCategory.label} maxLength={40} onChange={(event) => setNewCategory({ ...newCategory, label: event.target.value })} placeholder="Facturation" className={`${fieldClass} mt-1`} data-testid="category-label" /></label>
            <button type="submit" disabled={busy || !newCategory.id || !newCategory.label} className={primaryButton} data-testid="category-add"><Plus size={15} aria-hidden="true" />Ajouter</button>
          </form>
          <p className="mt-3 text-xs text-[#8f8f94]">Le formulaire public utilise cette même liste. Une catégorie déjà utilisée par des demandes ne peut pas être supprimée, seulement désactivée.</p>
        </Card>

        <Card title="Disponibilité du support" className="lg:col-span-2">
          <form noValidate className="space-y-3" onSubmit={(event) => { event.preventDefault(); void act('/api/admin/support/settings/availability', 'PUT', availability, availability.enabled ? 'Texte de disponibilité publié.' : 'Texte de disponibilité masqué.'); }}>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={availability.enabled} onChange={(event) => setAvailability({ ...availability, enabled: event.target.checked })} className="size-4 accent-[#E50914]" data-testid="availability-enabled" />Afficher un texte de disponibilité dans le Centre d’aide</label>
            <label className="block text-xs font-semibold text-[#9a9aa3]">Texte affiché<textarea rows={2} value={availability.text} maxLength={300} onChange={(event) => setAvailability({ ...availability, text: event.target.value })} className={`${fieldClass} mt-1 resize-y`} data-testid="availability-text" /></label>
            <button type="submit" disabled={busy} className={primaryButton} data-testid="availability-save">Enregistrer</button>
          </form>
          <p className="mt-3 text-xs text-[#8f8f94]">Rien n’est affiché aux visiteurs tant que vous ne l’avez pas activé : aucun horaire ni délai de réponse n’est inventé.</p>
        </Card>
      </div>
    </>
  );
}
