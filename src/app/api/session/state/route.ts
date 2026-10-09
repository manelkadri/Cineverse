import { NextResponse } from 'next/server';
import { resolveSessionState } from '@/lib/session-state';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Tells the page which of the five situations it is in (see lib/session-state.ts). It only describes the caller's own cookie and
// returns no identifier: the answer is always HTTP 200 so a database outage is not mistaken for a missing session.
export async function GET() {
  const result = await resolveSessionState();
  return NextResponse.json({ state: result.state }, { headers: { 'Cache-Control': 'no-store' } });
}
