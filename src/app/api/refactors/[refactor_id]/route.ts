import { NextResponse } from 'next/server';
import { loadRefactor } from '@/lib/refactor/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _req: Request,
  { params }: { params: { refactor_id: string } },
) {
  const proposal = loadRefactor(params.refactor_id);
  if (!proposal) {
    return NextResponse.json({ error: 'refactor_not_found' }, { status: 404 });
  }
  return NextResponse.json(proposal);
}
