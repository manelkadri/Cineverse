import { NextResponse } from 'next/server';
import { loadAvailability, loadCategories } from '@/lib/support-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Public: what the contact form offers. Only enabled categories are listed, so the form and the administration share one
// source. The availability text is included only when an administrator explicitly configured and enabled it.
export async function GET() {
  const [categories, availability] = await Promise.all([loadCategories(), loadAvailability()]);
  return NextResponse.json({
    categories: categories.filter((category) => category.enabled).map((category) => ({ id: category.id, label: category.label })),
    availability: availability.enabled && availability.text ? { text: availability.text } : null,
  }, { headers: { 'Cache-Control': 'no-store' } });
}
