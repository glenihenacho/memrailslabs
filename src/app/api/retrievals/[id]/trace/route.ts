import { NextResponse } from 'next/server';
import { findRetrieval } from '@/lib/memory';
import { authenticate, authErrorResponse } from '@/lib/auth/authenticate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request, { params }: { params: { id: string } }) {
  let owner_id: string;
  try {
    owner_id = authenticate(req).owner_id;
  } catch (err) {
    return authErrorResponse(err);
  }
  const bundle = findRetrieval(params.id);
  // Not-found and not-owned both 404 so retrieval ids don't leak across tenants.
  if (!bundle || bundle.scope.owner_id !== owner_id) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  return NextResponse.json({
    retrieval_id: bundle.retrieval_id,
    query: bundle.query,
    scope: bundle.scope,
    trace: bundle.retrieval_trace,
    memories: bundle.memories.map((m) => ({
      memory_id: m.memory_id,
      score: m.score,
      reason_selected: m.reason_selected,
    })),
    omitted: bundle.omitted,
  });
}
