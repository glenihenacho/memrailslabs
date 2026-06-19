import { NextResponse } from 'next/server';
import { ensureAccount } from '@/lib/accounts/store';
import { calculateRetrievalCost } from '@/lib/pricing/calculator';
import { authenticate, authErrorResponse } from '@/lib/auth/authenticate';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Usage summary for the authenticated owner — metered by retrieval, no quotas. */
export async function GET(req: Request) {
  // Owner comes from the API key (or the demo tenant), never a query param.
  let owner: string;
  try {
    owner = authenticate(req).owner_id;
  } catch (err) {
    return authErrorResponse(err);
  }
  const account = ensureAccount(owner);

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
