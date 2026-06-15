import { NextResponse } from 'next/server';
import { z } from 'zod';
import { recordFeedback } from '@/lib/memory';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Body = z.object({
  retrieval_id: z.string().min(1),
  memory_id: z.string().optional(),
  rating: z.enum(['positive', 'negative']),
  feedback_type: z.string().optional(),
  comment: z.string().max(2000).optional(),
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
  const result = recordFeedback(parsed.data);
  return NextResponse.json(result, { status: 201 });
}
