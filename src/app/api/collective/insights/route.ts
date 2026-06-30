import { NextResponse } from 'next/server';
import { requireOwner, authErrorResponse } from '@/lib/auth/authenticate';
import { isOptedIn } from '@/lib/accounts/store';
import { predictiveInsights, collectiveSize } from '@/lib/memory/collective';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Predictive insights from the collective — reciprocal: only opted-in tenants
 * may read. Returns aggregate topic predictions backed by ≥k other tenants;
 * never another tenant's content.
 */
export async function GET(req: Request) {
  let owner_id: string;
  try {
    owner_id = requireOwner(req);
  } catch (err) {
    return authErrorResponse(err);
  }
  if (!isOptedIn(owner_id)) {
    return NextResponse.json(
      { error: 'collective_opt_in_required', hint: 'POST /api/collective/opt-in {"opt_in":true}' },
      { status: 403 },
    );
  }
  const url = new URL(req.url);
  const minRaw = Number(url.searchParams.get('min_support'));
  const minSupport = Number.isFinite(minRaw) && minRaw >= 2 ? Math.floor(minRaw) : undefined;

  return NextResponse.json({
    owner_id,
    collective_size: collectiveSize(),
    support_threshold: minSupport ?? 3,
    insights: predictiveInsights(owner_id, { minSupport }),
  });
}
