import { NextResponse } from 'next/server';
import { readAllEvents } from '@/lib/ledger/jsonl';
import { withCors, corsOptions } from '@/lib/cors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function _GET(req: Request) {
  const url = new URL(req.url);
  const format = url.searchParams.get('format');

  let events;
  try {
    events = readAllEvents();
  } catch (err) {
    return NextResponse.json(
      { error: 'ledger_read_failed', detail: err instanceof Error ? err.message : 'unknown' },
      { status: 500 },
    );
  }

  if (format === 'jsonl') {
    const body = events.map((e) => JSON.stringify(e)).join('\n');
    return new Response(body, {
      headers: { 'content-type': 'application/x-ndjson' },
    });
  }

  return NextResponse.json({ events });
}

export const GET = withCors(_GET);
export const OPTIONS = () => corsOptions();
