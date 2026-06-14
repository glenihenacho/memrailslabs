/**
 * Managed rail router.
 *
 * MemRails operates the backend rails; the user never brings or sees them (no
 * BYO Neon/Upstash/R2/Qdrant). The router picks a rail + pool internally and
 * the public API stays `memory.retrieve()` regardless. Pools let MemRails route
 * cost-optimized infrastructure (free → shared → overflow → dedicated) as a
 * margin strategy — a deployment concern, invisible above this line.
 *
 * The default implementation is file-canonical (the MVP authority). Swapping in
 * real Postgres / object storage / vector rails means implementing `Rail`
 * providers behind this same interface; nothing above the router changes.
 */

export type RailKind =
  | 'sql_authority'
  | 'cache'
  | 'object'
  | 'vector'
  | 'graph'
  | 'telemetry';

export type RailPool = 'free' | 'shared' | 'overflow' | 'dedicated';

export type Rail = {
  kind: RailKind;
  pool: RailPool;
  provider: string;
};

export type RailContext = {
  plan?: 'free' | 'usage' | 'team' | 'enterprise';
  load?: 'normal' | 'high';
};

function poolFor(ctx: RailContext): RailPool {
  if (ctx.plan === 'enterprise') return 'dedicated';
  if (ctx.load === 'high') return 'overflow';
  if (ctx.plan && ctx.plan !== 'free') return 'shared';
  return 'free';
}

/**
 * Default file-canonical rail map. Real provider rails (Postgres, R2, Qdrant…)
 * plug in here without changing callers — that is the whole point of the router.
 */
const DEFAULT_PROVIDERS: Record<RailKind, string> = {
  sql_authority: 'file:governance.json',
  cache: 'memory:lru',
  object: 'file:knowledge+written',
  vector: 'none:tree-primary',
  graph: 'none:optional',
  telemetry: 'file:logs/*.jsonl',
};

export class RailRouter {
  constructor(private readonly providers: Partial<Record<RailKind, string>> = {}) {}

  select(kind: RailKind, ctx: RailContext = {}): Rail {
    return {
      kind,
      pool: poolFor(ctx),
      provider: this.providers[kind] ?? DEFAULT_PROVIDERS[kind],
    };
  }

  /** Rails touched by a standard retrieval, for internal cost accounting. */
  retrievalRails(ctx: RailContext = {}): Rail[] {
    return (['sql_authority', 'cache', 'object', 'telemetry'] as RailKind[]).map((k) =>
      this.select(k, ctx),
    );
  }
}

export const railRouter = new RailRouter();
