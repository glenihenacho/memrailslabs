import { NextResponse } from 'next/server';
import { z } from 'zod';
import { setCollectiveOptIn } from '@/lib/accounts/store';
import { requireOwner, authErrorResponse } from '@/lib/auth/authenticate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Body = z.object({ opt_in: z.boolean() });

/**
 * Consent to (or leave) the cross-tenant collective. Server-authoritative —
 * a real API key is required; a client cookie is only a UX mirror of this flag.
 */
export async function POST(req: Request) {
  let owner_id: string;
  try {
    owner_id = requireOwner(req);
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
  const account = setCollectiveOptIn(owner_id, parsed.data.opt_in);
  return NextResponse.json({ owner_id, collective_opt_in: account.collective_opt_in === true });
}
