import { NextResponse } from 'next/server';
import { clusterIntents, loadObservations } from '@/lib/demand/aggregate';
import { rank, score } from '@/lib/demand/popularity';
import { parseWindow } from '@/lib/demand/window';
import { genuinenessFor } from '@/lib/demand/genuineness';
import { listStakes } from '@/lib/demand/stake';
import { withCors, corsOptions } from '@/lib/cors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TOP_MIN = 1;
const TOP_MAX = 500;
const TOP_DEFAULT = 50;

async function _GET(req: Request) {
  const url = new URL(req.url);
  const since = url.searchParams.get('since') ?? undefined;
  const topRaw = Number(url.searchParams.get('top') ?? TOP_DEFAULT);
  const top = Number.isFinite(topRaw)
    ? Math.min(TOP_MAX, Math.max(TOP_MIN, Math.floor(topRaw)))
    : TOP_DEFAULT;
  // Optional ?genuineness=off — bypass the genuineness multiplier. Useful for
  // sanity-checking ranking effects (and for the Phase 4 acceptance demo).
  const genuinenessMode = url.searchParams.get('genuineness') ?? 'on';

  const window = parseWindow(since);
  const observations = loadObservations({
    since: new Date(window.since),
    until: new Date(window.until),
  });
  const clusters = clusterIntents(observations);
  const stakes = listStakes();
  const scored = rank(
    clusters.map((c) => {
      const g = genuinenessMode === 'off' ? 1.0 : genuinenessFor(c, observations, stakes);
      return score(c, observations, { window, genuineness: g });
    }),
  ).slice(0, top);

  return NextResponse.json({
    window,
    totals: {
      observations: observations.length,
      clusters: clusters.length,
      distinct_actors: new Set(observations.map((o) => o.actor_id)).size,
      active_stakes: stakes.filter((s) => s.status === 'active').length,
    },
    clusters: scored,
  });
}

export const GET = withCors(_GET);
export const OPTIONS = () => corsOptions();
