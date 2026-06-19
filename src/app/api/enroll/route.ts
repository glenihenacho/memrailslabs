import { NextResponse } from 'next/server';
import { z } from 'zod';
import { enroll } from '@/lib/accounts/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Body = z.object({
  email: z.string().email(),
  plan: z.enum(['free', 'usage', 'team', 'enterprise']).optional(),
});

/**
 * Enrollment provisions one isolated tenant per email. The free tier is
 * retrieval credits, not memory caps. Backend rails are allocated by the rail
 * router — the user only ever sees this account + an API key.
 */
export async function POST(req: Request) {
  // Optional enrollment gate: when MEMRAILS_ENROLL_TOKEN is set, callers must
  // present it (x-enroll-token), preventing open credential issuance in prod.
  // Unset (dev/demo) leaves enrollment open.
  const enrollToken = process.env.MEMRAILS_ENROLL_TOKEN;
  if (enrollToken && req.headers.get('x-enroll-token') !== enrollToken) {
    return NextResponse.json({ error: 'enrollment_forbidden' }, { status: 403 });
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
  const result = enroll(parsed.data.email, parsed.data.plan ?? 'free');
  return NextResponse.json(result, { status: 201 });
}
