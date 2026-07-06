import { NextResponse } from 'next/server';
import { z } from 'zod';
import { updateConfidence, getRecord } from '@/lib/memory';
import { requireOwner, authErrorResponse } from '@/lib/auth/authenticate';
import { ensureAuthorityReady, flushAuthority } from '@/lib/memory/authority';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Body = z.object({
  confidence: z.number().min(0).max(1),
  reason: z.string().min(1).max(500).optional(),
});

/** §4.6 — a re-score is a versioned, evented transition, never a silent edit. */
export async function POST(req: Request, { params }: { params: { id: string } }) {
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
  let owner_id: string;
  try {
    owner_id = requireOwner(req);
  } catch (err) {
    return authErrorResponse(err);
  }
  await ensureAuthorityReady();
  const target = getRecord(params.id, { force: true });
  if (!target || target.scope.owner_id !== owner_id) {
    return NextResponse.json({ error: 'memory_not_found' }, { status: 404 });
  }
  try {
    const result = updateConfidence(params.id, { ...parsed.data, changed_by: 'api' });
    await flushAuthority();
    return NextResponse.json(result);
  } catch (err) {
    const message = (err as Error).message;
    const status = message === 'memory_not_found' ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
