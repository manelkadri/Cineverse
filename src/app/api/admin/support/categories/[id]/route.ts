import { NextResponse } from 'next/server';
import { revalidateHelp } from '@/lib/help-revalidate';
import { prisma } from '@/lib/prisma';
import { requireSupportAdmin } from '@/lib/support-admin';
import { auditEntry, loadCategories } from '@/lib/support-server';
import { supportCategoryPatchSchema } from '@/lib/validation';

export const runtime = 'nodejs';

// Renames, disables/enables or moves one contact-form category. A built-in category gets a database row the first time it is
// changed (the built-in definition stays in code as the default). At least one category always stays enabled.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const access = await requireSupportAdmin(request, { mutation: true });
  if ('response' in access) return access.response;
  const parsed = supportCategoryPatchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Demande invalide.', code: 'INVALID_REQUEST' }, { status: 400 });
  const { id } = await params;
  const list = await loadCategories();
  const index = list.findIndex((category) => category.id === id);
  if (index < 0) return NextResponse.json({ error: 'Catégorie introuvable.', code: 'NOT_FOUND' }, { status: 404 });
  const next = list.map((category) => ({ ...category }));
  const target = next[index];
  const changed = new Set<string>([id]);
  const what: string[] = [];

  if (parsed.data.label !== undefined && parsed.data.label !== target.label) { target.label = parsed.data.label; what.push('label'); }
  if (parsed.data.enabled !== undefined && parsed.data.enabled !== target.enabled) { target.enabled = parsed.data.enabled; what.push(parsed.data.enabled ? 'enabled' : 'disabled'); }
  if (parsed.data.move) {
    const swap = parsed.data.move === 'up' ? index - 1 : index + 1;
    if (swap >= 0 && swap < next.length) {
      [target.position, next[swap].position] = [next[swap].position, target.position];
      changed.add(next[swap].id);
      what.push('moved');
    }
  }
  if (what.length === 0) return NextResponse.json({ categories: list }, { headers: { 'Cache-Control': 'no-store' } });
  if (!next.some((category) => category.enabled)) return NextResponse.json({ error: 'Au moins une catégorie doit rester active.', code: 'LAST_CATEGORY' }, { status: 409 });

  const actorId = access.context.userId;
  await prisma.$transaction([
    ...next.filter((category) => changed.has(category.id)).map((category) => prisma.supportCategory.upsert({ where: { id: category.id }, create: { id: category.id, label: category.label, enabled: category.enabled, position: category.position }, update: { label: category.label, enabled: category.enabled, position: category.position } })),
    auditEntry(actorId, 'settings.category_changed', 'category', id, { change: what.join(',') }),
  ]);
  revalidateHelp();
  return NextResponse.json({ categories: await loadCategories() }, { headers: { 'Cache-Control': 'no-store' } });
}
