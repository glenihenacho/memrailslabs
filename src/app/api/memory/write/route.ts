import { NextResponse } from 'next/server';
import { z } from 'zod';
import { write } from '@/lib/memory';
import { requireOwner, authErrorResponse } from '@/lib/auth/authenticate';
import { ensureAuthorityReady, flushAuthority } from '@/lib/memory/authority';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SCOPE_ID = /^[A-Za-z0-9_-]+$/;

const Body = z.object({
  content: z.string().min(1).max(8000).refine((s) => s.trim().length > 0, {
    message: 'content must not be blank',
  }),
  summary: z.string().max(400).optional(),
  // Scope ids reach the filesystem (federation namespaces) — keep them to a
  // safe charset so they can never encode path traversal.
  owner_id: z.string().regex(SCOPE_ID).optional(),
  project_id: z.string().regex(SCOPE_ID).optional(),
  agent_id: z.string().regex(SCOPE_ID).optional(),
  memory_type: z
    .enum(['decision', 'preference', 'note', 'summary', 'extraction', 'correction', 'constraint', 'claim'])
    .optional(),
  confidence: z.number().min(0).max(1).optional(),
  sensitivity: z.enum(['normal', 'sensitive', 'restricted']).optional(),
  tags: z.array(z.string()).optional(),
  index_path: z.string().optional(),
  // Validity window (C5.2): past this instant the record leaves retrieval
  // and the staleness job re-verifies it with a governed downgrade.
  expires_at: z.string().datetime({ offset: true }).optional(),
  source: z
    .object({
      type: z.enum(['conversation', 'file', 'tool_result', 'manual', 'api', 'correction']),
      id: z.string().optional(),
      ref: z.string().optional(),
      hash: z.string().optional(),
    })
    .optional(),
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
  let owner_id: string;
  try {
    owner_id = requireOwner(req); // writes require a real key, not the demo tenant
  } catch (err) {
    return authErrorResponse(err);
  }
  await ensureAuthorityReady();
  const result = write({ ...parsed.data, owner_id });
  await flushAuthority();
  return NextResponse.json(result, { status: 201 });
}
