import { NextResponse } from 'next/server';
import { getRecord, forget } from '@/lib/memory';
import { authenticate, requireOwner, authErrorResponse } from '@/lib/auth/authenticate';
import { ensureAuthorityReady, flushAuthority } from '@/lib/memory/authority';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: { id: string } }) {
  let owner_id: string;
  try {
    owner_id = authenticate(req).owner_id;
  } catch (err) {
    return authErrorResponse(err);
  }
  await ensureAuthorityReady();
  const record = getRecord(params.id, { force: true });
  // Not-found and not-owned both return 404 so existence never leaks across tenants.
  if (!record || record.scope.owner_id !== owner_id) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  return NextResponse.json(record);
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  let owner_id: string;
  try {
    owner_id = requireOwner(req); // forget is a mutation — real key required
  } catch (err) {
    return authErrorResponse(err);
  }
  await ensureAuthorityReady();
  const record = getRecord(params.id, { force: true });
  if (!record || record.scope.owner_id !== owner_id) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  const url = new URL(req.url);
  const reason = url.searchParams.get('reason') ?? undefined;
  const result = forget(params.id, { reason, changed_by: 'api' });
  await flushAuthority();
  return NextResponse.json(result);
}
