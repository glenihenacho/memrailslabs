import { NextResponse } from 'next/server';
import {
  InvalidTransition,
  RefactorNotFound,
  rejectRefactor,
} from '@/lib/refactor/proposals';
import { withCors, corsOptions } from '@/lib/cors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_BODY_BYTES = 64 * 1024;

async function _POST(
  req: Request,
  { params }: { params: { refactor_id: string } },
) {
  const declaredSize = Number(req.headers.get('content-length') ?? '0');
  if (declaredSize > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'payload_too_large' }, { status: 413 });
  }

  let reason: string | undefined;
  const contentType = req.headers.get('content-type') ?? '';
  if (contentType.includes('application/json') && declaredSize > 0) {
    try {
      const json = (await req.json()) as { reason?: string };
      if (typeof json.reason === 'string') reason = json.reason.slice(0, 2000);
    } catch {
      return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
    }
  }

  try {
    const proposal = rejectRefactor(params.refactor_id, reason);
    return NextResponse.json(proposal);
  } catch (err) {
    if (err instanceof RefactorNotFound) {
      return NextResponse.json({ error: 'refactor_not_found' }, { status: 404 });
    }
    if (err instanceof InvalidTransition) {
      return NextResponse.json(
        { error: 'invalid_transition', detail: err.message },
        { status: 409 },
      );
    }
    return NextResponse.json(
      {
        error: 'internal_error',
        detail: err instanceof Error ? err.message : 'unknown',
      },
      { status: 500 },
    );
  }
}

export const POST = withCors(_POST);
export const OPTIONS = () => corsOptions();
