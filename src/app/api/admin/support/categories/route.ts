import { NextResponse } from 'next/server';
import { revalidateHelp } from '@/lib/help-revalidate';
import { prisma } from '@/lib/prisma';
import { requireSupportAdmin } from '@/lib/support-admin';
import { auditEntry, loadCategories } from '@/lib/support-server';
import { supportCategoryCreateSchema } from '@/lib/validation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const access = await requireSupportAdmin(request);
  if ('response' in access) return access.response;
  return NextResponse.json({ categories: await loadCategories() }, { headers: { 'Cache-Control': 'no-store' } });
}

// Adds a category to the contact form. The built-in categories cannot be deleted (tickets already use them): they can be
// renamed, disabled and reordered. The public form reads this same list, so the two cannot drift apart.
export async function POST(request: Request) {
  const access = await requireSupportAdmin(request, { mutation: true });
  if ('response' in access) return access.response;
  const parsed = supportCategoryCreateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Demande invalide.', code: 'INVALID_REQUEST' }, { status: 400 });
  const current = await loadCategories();
  if (current.some((category) => category.id === parsed.data.id)) return NextResponse.json({ error: 'Cet identifiant existe déjà.', code: 'DUPLICATE' }, { status: 409 });
  const position = Math.max(0, ...current.map((category) => category.position)) + 10;
  const actorId = access.context.userId;
  await prisma.$transaction([
    prisma.supportCategory.create({ data: { id: parsed.data.id, label: parsed.data.label, enabled: true, position } }),
    auditEntry(actorId, 'settings.category_created', 'category', parsed.data.id),
  ]);
  revalidateHelp();
  return NextResponse.json({ categories: await loadCategories() }, { status: 201, headers: { 'Cache-Control': 'no-store' } });
}
