import { NextResponse } from 'next/server';
import { z } from 'zod';
import { compileView } from '@/lib/memory';
import { authenticate, authErrorResponse } from '@/lib/auth/authenticate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SCOPE_ID = /^[A-Za-z0-9_-]+$/;
const ISO = z.string().datetime({ offset: true });

const Body = z.object({
  task_context: z.string().min(1).max(4000),
  project_id: z.string().regex(SCOPE_ID).optional(),
  from: ISO.optional(),
  to: ISO.optional(),
  as_of: ISO.optional(),
});

/**
 * Prompt-compiled, made-to-order index over a time slice. Returns the complete
 * in-window memory organized around the prompt — sections ordered by relevance,
 * nothing dropped. Owner-scoped via the API key.
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
    return NextResponse.json({ error: 'as_of and from/to are mutually exclusive' }, { status: 400 });
  }

  const view = compileView({ ...parsed.data, owner_id });
  return NextResponse.json(view);
}
