import { NextResponse } from 'next/server';
import { loadSession } from '@/lib/payments/store';
import { withCors, corsOptions } from '@/lib/cors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function _GET(
  _req: Request,
  { params }: { params: { session_id: string } },
) {
  const session = loadSession(params.session_id);
  if (!session) {
    return NextResponse.json({ error: 'session_not_found' }, { status: 404 });
  }
  return NextResponse.json({
    ...session,
    remaining_cents: session.budget_cents - session.spent_cents,
  });
}

export const GET = withCors(_GET);
export const OPTIONS = () => corsOptions();
