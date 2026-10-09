import { NextResponse } from 'next/server';
import { authSecret } from '@/lib/auth-security';

export function GET() {
  return NextResponse.json({
    configured: Boolean(process.env.DATABASE_URL && authSecret()),
    databaseConfigured: Boolean(process.env.DATABASE_URL),
    secretConfigured: Boolean(authSecret()),
  });
}
