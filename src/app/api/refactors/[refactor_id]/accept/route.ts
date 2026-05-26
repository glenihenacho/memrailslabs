import { NextResponse } from 'next/server';
import {
  acceptRefactor,
  InvalidTransition,
  ProposalRejected,
  RefactorNotFound,
} from '@/lib/refactor/proposals';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
  _req: Request,
  { params }: { params: { refactor_id: string } },
) {
  try {
    const proposal = acceptRefactor(params.refactor_id);
    return NextResponse.json(proposal);
  } catch (err) {
    if (err instanceof RefactorNotFound) {
      return NextResponse.json({ error: 'refactor_not_found' }, { status: 404 });
    }
    if (err instanceof InvalidTransition) {
      return NextResponse.json(
        { error: 'invalid_transition', detail: err.message },
        { status: 409 },
      );
    }
    if (err instanceof ProposalRejected) {
      return NextResponse.json(
        { error: 'proposal_rejected', detail: err.message },
        { status: 422 },
      );
    }
    return NextResponse.json(
      {
        error: 'internal_error',
        detail: err instanceof Error ? err.message : 'unknown',
      },
      { status: 500 },
    );
  }
}
