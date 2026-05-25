import { NextResponse } from 'next/server';
import { readAllEvents } from '@/lib/ledger/jsonl';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const format = url.searchParams.get('format');
  const events = readAllEvents();

  if (format === 'jsonl') {
    const body = events.map((e) => JSON.stringify(e)).join('\n');
    return new Response(body, {
      headers: { 'content-type': 'application/x-ndjson' },
    });
  }

  return NextResponse.json({ events });
}
