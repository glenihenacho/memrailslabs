import { NextResponse } from 'next/server';
import { authorizeSession } from '@/lib/payments/sessions';
import { listSessions } from '@/lib/payments/store';
import { SessionAuthorizeInputSchema } from '@/lib/memory/schema';
import { withCors, corsOptions } from '@/lib/cors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BODY_BYTES = 64 * 1024;

async function _GET() {
  const sessions = listSessions().map((s) => ({
    ...s,
    remaining_cents: s.budget_cents - s.spent_cents,
  }));
  return NextResponse.json({ sessions });
}

async function _POST(req: Request) {
  const declaredSize = Number(req.headers.get('content-length') ?? '0');
  if (declaredSize > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'payload_too_large' }, { status: 413 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const parsed = SessionAuthorizeInputSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_input', issues: parsed.error.issues },
      { status: 422 },
    );
  }

  const session = authorizeSession(parsed.data);
  return NextResponse.json(
    { ...session, remaining_cents: session.budget_cents - session.spent_cents },
    { status: 201 },
  );
}

export const GET = withCors(_GET);
export const POST = withCors(_POST);
export const OPTIONS = () => corsOptions();
