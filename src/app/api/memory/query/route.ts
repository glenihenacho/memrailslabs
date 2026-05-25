import { NextResponse } from 'next/server';
import { query } from '@/lib/memory';
import { QueryInputSchema } from '@/lib/memory/schema';

export const runtime = 'nodejs';

const MAX_BODY_BYTES = 64 * 1024;
const QUERY_TIMEOUT_MS = 15_000;

/**
 * Error contract:
 *  - 400 `invalid_json`  malformed JSON body
 *  - 400 `invalid_input` Zod parse failure; see `issues[]`
 *  - 413 `payload_too_large` body exceeds 64KB
 *  - 504 `timeout` query exceeded 15s
 *  - 500 `internal_error` unexpected failure
 */

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolveFn, rejectFn) => {
    const timer = setTimeout(() => rejectFn(new Error('timeout')), ms);
    p.then(
      (v) => {
        clearTimeout(timer);
        resolveFn(v);
      },
      (e) => {
        clearTimeout(timer);
        rejectFn(e);
      },
    );
  });
}

export async function POST(req: Request) {
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

  const parsed = QueryInputSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_input', issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    const packet = await withTimeout(query(parsed.data), QUERY_TIMEOUT_MS);
    return NextResponse.json(packet);
  } catch (err) {
    if (err instanceof Error && err.message === 'timeout') {
      return NextResponse.json({ error: 'timeout' }, { status: 504 });
    }
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
