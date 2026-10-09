import { hash } from 'bcryptjs';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { authIdentity, AuthRateLimitError, enforceAuthRateLimit, isAuthRuntimeConfigured, recordAuthAttempt } from '@/lib/auth-security';
import { registrationSchema } from '@/lib/validation';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  if (!isAuthRuntimeConfigured()) return NextResponse.json({ error: 'Authentication is not configured' }, { status: 503 });
  const parsed = registrationSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid registration data', fields: parsed.error.flatten().fieldErrors }, { status: 400 });
  const { email, name, password } = parsed.data;
  const identity = authIdentity(email, request.headers);
  try {
    await enforceAuthRateLimit(identity);
  } catch (error) {
    if (error instanceof AuthRateLimitError) return NextResponse.json({ error: 'Too many attempts. Try again later.' }, { status: 429, headers: { 'Retry-After': String(error.retryAfterSeconds) } });
    throw error;
  }
  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) {
    await recordAuthAttempt(identity, false);
    return NextResponse.json({ error: 'An account already exists for this email' }, { status: 409 });
  }
  const passwordHash = await hash(password, 12);
  await prisma.user.create({ data: { email, name, passwordHash } });
  await recordAuthAttempt(identity, true);
  return NextResponse.json({ registered: true }, { status: 201 });
}
