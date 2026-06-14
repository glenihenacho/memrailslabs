import { NextResponse } from 'next/server';
import { getAccount } from '@/lib/accounts/store';
import { calculateRetrievalCost } from '@/lib/pricing/calculator';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Usage summary for an owner — metered by retrieval, no quota surface. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const owner = url.searchParams.get('owner_id') ?? 'user_memrails';
  const account = getAccount(owner);
  if (!account) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  return NextResponse.json({
    owner_id: account.owner_id,
    plan: account.plan,
    retrievals_total: account.retrievals_total,
    credits_remaining: account.credits_remaining,
    spend_usd: account.spend_usd,
    projected_cost_usd: calculateRetrievalCost(account.retrievals_total),
    billing_unit: '1 successful memory.retrieve() = 1 billable retrieval',
  });
}
