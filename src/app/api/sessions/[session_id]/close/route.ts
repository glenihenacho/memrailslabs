import { NextResponse } from 'next/server';
import { closeSession, SessionNotFound } from '@/lib/payments/sessions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
  _req: Request,
  { params }: { params: { session_id: string } },
) {
  try {
    const session = closeSession(params.session_id);
    return NextResponse.json({
      ...session,
      remaining_cents: session.budget_cents - session.spent_cents,
    });
  } catch (err) {
    if (err instanceof SessionNotFound) {
      return NextResponse.json({ error: 'session_not_found' }, { status: 404 });
    }
    return NextResponse.json(
      { error: 'internal_error', detail: err instanceof Error ? err.message : 'unknown' },
      { status: 500 },
    );
  }
}
