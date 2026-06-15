import { NextResponse } from 'next/server';
import { z } from 'zod';
import { supersede } from '@/lib/memory';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Body = z
  .object({
    reason: z.string().max(500).optional(),
    new_memory_id: z.string().optional(),
    new_memory: z
      .object({
        content: z.string().min(1).max(8000),
        summary: z.string().max(400).optional(),
        memory_type: z
          .enum(['decision', 'preference', 'note', 'summary', 'extraction', 'correction', 'constraint', 'claim'])
          .optional(),
        confidence: z.number().min(0).max(1).optional(),
        tags: z.array(z.string()).optional(),
        index_path: z.string().optional(),
      })
      .optional(),
  })
  // A replacement is given either by id or inline body, never both.
  .refine((b) => !(b.new_memory_id && b.new_memory), {
    message: 'new_memory_id and new_memory are mutually exclusive',
  });

export async function POST(req: Request, { params }: { params: { id: string } }) {
  let json: unknown = {};
  try {
    json = await req.json();
  } catch {
    // empty body is allowed (mark-superseded with no replacement)
  }
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_input', issues: parsed.error.issues }, { status: 400 });
  }
  try {
    const result = supersede(params.id, { ...parsed.data, changed_by: 'api' });
    return NextResponse.json(result);
  } catch (err) {
    const message = (err as Error).message;
    if (message === 'memory_not_found') return NextResponse.json({ error: message }, { status: 404 });
    if (message === 'cannot_supersede_with_self') return NextResponse.json({ error: message }, { status: 400 });
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
