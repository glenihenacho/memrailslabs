import { NextResponse } from 'next/server';
import { listRefactors } from '@/lib/refactor/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const proposals = listRefactors().map((p) => ({
    refactor_id: p.refactor_id,
    type: p.type,
    target_file: p.target_file,
    target_claim_id: p.target_claim_id,
    status: p.status,
    claim_preview: p.claim_text.slice(0, 160),
    validator: p.validator,
    stake: p.stake,
    created_at: p.created_at,
    updated_at: p.updated_at,
  }));
  return NextResponse.json({ refactors: proposals });
}
