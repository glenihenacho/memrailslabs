import { NextResponse } from 'next/server';
import { findRetrieval } from '@/lib/memory';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const bundle = findRetrieval(params.id);
  if (!bundle) return NextResponse.json({ error: 'not_found' }, { status: 404 });
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
