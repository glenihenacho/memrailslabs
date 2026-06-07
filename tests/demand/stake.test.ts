import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  InvalidStakeAmount,
  InvalidStakeTransition,
  StakeNotFound,
  listStakes,
  loadStake,
  postStake,
  releaseStake,
  slashStake,
  stakesDir,
} from '@/lib/demand/stake';
import { readAllEvents } from '@/lib/ledger/jsonl';

let dataDir: string;
const originalDataDir = process.env.DATA_DIR;

beforeEach(() => {
  dataDir = mkdtempSync(join(tmpdir(), 'memrails-stake-'));
  process.env.DATA_DIR = dataDir;
});

afterEach(() => {
  if (originalDataDir === undefined) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = originalDataDir;
  if (existsSync(dataDir)) rmSync(dataDir, { recursive: true, force: true });
});

describe('postStake()', () => {
  it('creates a stk_<12 hex> file under data/demand/stakes/', () => {
    const s = postStake({ actor_id: 'a', cluster_id: 'tic_x', amount_cents: 100 });
    expect(s.stake_id).toMatch(/^stk_[0-9a-f]{12}$/);
    expect(s.status).toBe('active');
    expect(readdirSync(stakesDir())).toContain(`${s.stake_id}.json`);
  });

  it('rejects non-positive amounts', () => {
    expect(() => postStake({ actor_id: 'a', cluster_id: 'tic_x', amount_cents: 0 })).toThrow(
      InvalidStakeAmount,
    );
    expect(() => postStake({ actor_id: 'a', cluster_id: 'tic_x', amount_cents: -5 })).toThrow(
      InvalidStakeAmount,
    );
  });

  it('emits an INTENT_STAKE_POSTED ledger event', () => {
    const s = postStake({ actor_id: 'a', cluster_id: 'tic_x', amount_cents: 200 });
    const evt = readAllEvents().find(
      (e) => e.event_type === 'INTENT_STAKE_POSTED' && e.metadata.stake_id === s.stake_id,
    );
    expect(evt).toBeDefined();
    expect(evt?.metadata.amount_cents).toBe(200);
    expect(evt?.actor_id).toBe('a');
  });
});

describe('loadStake() + listStakes()', () => {
  it('round-trips a stake', () => {
    const s = postStake({ actor_id: 'a', cluster_id: 'tic_x', amount_cents: 100 });
    expect(loadStake(s.stake_id)).toEqual(s);
  });

  it('returns null for malformed stake_id', () => {
    expect(loadStake('not_a_stake_id')).toBeNull();
    expect(loadStake('stk_../escape')).toBeNull();
  });

  it('filters by cluster_id and actor_id and status', () => {
    postStake({ actor_id: 'a', cluster_id: 'tic_x', amount_cents: 100 });
    postStake({ actor_id: 'b', cluster_id: 'tic_x', amount_cents: 200 });
    postStake({ actor_id: 'a', cluster_id: 'tic_y', amount_cents: 50 });
    expect(listStakes({ cluster_id: 'tic_x' })).toHaveLength(2);
    expect(listStakes({ actor_id: 'a' })).toHaveLength(2);
    expect(listStakes({ status: 'active' })).toHaveLength(3);
  });
});

describe('slashStake()', () => {
  it('flips status to slashed and stamps the reason', () => {
    const s = postStake({ actor_id: 'a', cluster_id: 'tic_x', amount_cents: 100 });
    const after = slashStake(s.stake_id, 'sybil');
    expect(after.status).toBe('slashed');
    expect(after.reason_if_slashed).toBe('sybil');
    expect(loadStake(s.stake_id)?.status).toBe('slashed');
  });

  it('emits an INTENT_STAKE_SLASHED ledger event', () => {
    const s = postStake({ actor_id: 'a', cluster_id: 'tic_x', amount_cents: 100 });
    slashStake(s.stake_id, 'rate_abuse');
    const evt = readAllEvents().find(
      (e) => e.event_type === 'INTENT_STAKE_SLASHED' && e.metadata.stake_id === s.stake_id,
    );
    expect(evt?.metadata.reason).toBe('rate_abuse');
    expect(evt?.actor_id).toBe('a');
  });

  it('rejects slashing a stake that is not active', () => {
    const s = postStake({ actor_id: 'a', cluster_id: 'tic_x', amount_cents: 100 });
    slashStake(s.stake_id, 'sybil');
    expect(() => slashStake(s.stake_id, 'sybil')).toThrow(InvalidStakeTransition);
  });

  it('throws StakeNotFound for unknown ids', () => {
    expect(() => slashStake('stk_doesnotexist', 'sybil')).toThrow(StakeNotFound);
  });
});

describe('releaseStake()', () => {
  it('flips status to released and does NOT emit a slash event', () => {
    const s = postStake({ actor_id: 'a', cluster_id: 'tic_x', amount_cents: 100 });
    const after = releaseStake(s.stake_id);
    expect(after.status).toBe('released');
    const slashed = readAllEvents().filter((e) => e.event_type === 'INTENT_STAKE_SLASHED');
    expect(slashed).toHaveLength(0);
  });
});
