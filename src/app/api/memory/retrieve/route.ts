import { NextResponse } from 'next/server';
import { z } from 'zod';
import { retrieve } from '@/lib/memory';
import { authenticate, authErrorResponse } from '@/lib/auth/authenticate';
// Side-effect import: installs the billing meter into the kernel's metering
// seam so API retrievals stay billed (1 retrieve = 1 billable retrieval).
import '@/lib/billing/meter';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SCOPE_ID = /^[A-Za-z0-9_-]+$/;

const Body = z.object({
  task_context: z.string().min(1).max(4000),
  owner_id: z.string().regex(SCOPE_ID).optional(),
  project_id: z.string().regex(SCOPE_ID).optional(),
  agent_id: z.string().regex(SCOPE_ID).optional(),
  max_tokens: z.number().int().positive().max(8000).optional(),
  retrieval_mode: z.enum(['exact', 'tree', 'hybrid', 'hot', 'debug']).optional(),
  include_evidence: z.boolean().optional(),
  include_disputed: z.boolean().optional(),
  include_packet: z.boolean().optional(),
});

export async function POST(req: Request) {
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
  // Owner is derived from the API key (or the demo tenant), never trusted from
  // the body — a caller can only read memory in their own namespace.
  let owner_id: string;
  try {
    owner_id = authenticate(req).owner_id;
  } catch (err) {
    return authErrorResponse(err);
  }
  const bundle = retrieve({ ...parsed.data, owner_id });
  return NextResponse.json(bundle);
}
