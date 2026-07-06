import { NextResponse } from 'next/server';
import { readLedger } from '@/lib/ledger/events';
import { authenticate, authErrorResponse } from '@/lib/auth/authenticate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  let owner_id: string;
  try {
    owner_id = authenticate(req).owner_id;
  } catch (err) {
    return authErrorResponse(err);
  }
  const url = new URL(req.url);
  const format = url.searchParams.get('format');
  // Telemetry is a global plane; scope the read to the caller's own events
  // (plus system events that carry no owner) so the ledger never leaks tenants.
  const events = (await readLedger()).filter((e) => e.owner_id === owner_id || e.owner_id === undefined);

  if (format === 'jsonl') {
    const body = events.map((e) => JSON.stringify(e)).join('\n');
    return new Response(body, {
      headers: { 'content-type': 'application/x-ndjson' },
    });
  }

  return NextResponse.json({ events });
}
