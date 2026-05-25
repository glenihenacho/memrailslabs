import { NextResponse } from 'next/server';
import { z } from 'zod';
import { query } from '@/lib/memory';

export const runtime = 'nodejs';

const Body = z.object({
  query: z.string().min(1).max(2000),
  intent: z
    .enum(['answer', 'summarize', 'compare', 'extract', 'refactor', 'route'])
    .optional(),
  max_tokens: z.number().int().positive().max(2000).optional(),
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
    return NextResponse.json(
      { error: 'invalid_input', issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const packet = await query(parsed.data);
  return NextResponse.json(packet);
}
