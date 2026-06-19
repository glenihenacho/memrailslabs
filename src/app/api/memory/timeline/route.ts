import { NextResponse } from 'next/server';
import { z } from 'zod';
import { compileTimeline } from '@/lib/memory';
import { authenticate, authErrorResponse } from '@/lib/auth/authenticate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SCOPE_ID = /^[A-Za-z0-9_-]+$/;
const ISO = z.string().datetime({ offset: true });

const Body = z.object({
  project_id: z.string().regex(SCOPE_ID).optional(),
  from: ISO.optional(),
  to: ISO.optional(),
  as_of: ISO.optional(),
});

/**
 * Temporal retrieval — the completeness contract. Returns ALL of the caller's
 * in-scope memory for a window (or the active set as-of an instant), organized
 * by topic and ordered by system time. Owner-scoped via the API key.
 */
export async function POST(req: Request) {
  let owner_id: string;
  try {
    owner_id = authenticate(req).owner_id;
  } catch (err) {
    return authErrorResponse(err);
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_input', issues: parsed.error.issues }, { status: 400 });
  }
  if (parsed.data.as_of && (parsed.data.from || parsed.data.to)) {
    return NextResponse.json(
      { error: 'as_of and from/to are mutually exclusive' },
      { status: 400 },
    );
  }

  const timeline = compileTimeline({ ...parsed.data, owner_id });
  return NextResponse.json(timeline);
}
