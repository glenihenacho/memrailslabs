import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { dataRoot } from '@/lib/runtime';
import { logEvent } from '@/lib/ledger/events';
import type {
  IntentStake,
  IntentStakeSlashReason,
  IntentStakeStatus,
} from '@/types/demand';

const STAKE_ID_PATTERN = /^stk_[a-z0-9]{6,32}$/;

export function stakesDir(): string {
  return resolve(dataRoot(), 'demand', 'stakes');
}

function ensureDir(): void {
  const dir = stakesDir();
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function writeStake(stake: IntentStake): void {
  ensureDir();
  const path = resolve(stakesDir(), `${stake.stake_id}.json`);
  writeFileSync(path, `${JSON.stringify(stake, null, 2)}\n`, 'utf8');
}

export type PostStakeInput = {
  actor_id: string;
  cluster_id: string;
  amount_cents: number;
};

export function postStake(input: PostStakeInput): IntentStake {
  if (input.amount_cents <= 0) throw new InvalidStakeAmount(input.amount_cents);
  const now = new Date().toISOString();
  const stake: IntentStake = {
    stake_id: `stk_${randomUUID().replace(/-/g, '').slice(0, 12)}`,
    actor_id: input.actor_id,
    cluster_id: input.cluster_id,
    amount_cents: input.amount_cents,
    status: 'active',
    created_at: now,
    updated_at: now,
  };
  writeStake(stake);
  logEvent(
    'INTENT_STAKE_POSTED',
    {
      stake_id: stake.stake_id,
      cluster_id: stake.cluster_id,
      amount_cents: stake.amount_cents,
    },
    { actor_id: stake.actor_id },
  );
  return stake;
}

export function loadStake(stake_id: string): IntentStake | null {
  if (!STAKE_ID_PATTERN.test(stake_id)) return null;
  const path = resolve(stakesDir(), `${stake_id}.json`);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as IntentStake;
  } catch {
    return null;
  }
}

export type ListStakesFilter = {
  cluster_id?: string;
  actor_id?: string;
  status?: IntentStakeStatus;
};

export function listStakes(filter: ListStakesFilter = {}): IntentStake[] {
  const dir = stakesDir();
  if (!existsSync(dir)) return [];
  const files = readdirSync(dir).filter((f) => f.endsWith('.json'));
  const out: IntentStake[] = [];
  for (const f of files) {
    try {
      const raw = readFileSync(resolve(dir, f), 'utf8');
      const s = JSON.parse(raw) as IntentStake;
      if (filter.cluster_id && s.cluster_id !== filter.cluster_id) continue;
      if (filter.actor_id && s.actor_id !== filter.actor_id) continue;
      if (filter.status && s.status !== filter.status) continue;
      out.push(s);
    } catch {
      // skip malformed
    }
  }
  out.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  return out;
}

export function slashStake(stake_id: string, reason: IntentStakeSlashReason): IntentStake {
  const existing = loadStake(stake_id);
  if (!existing) throw new StakeNotFound(stake_id);
  if (existing.status !== 'active') throw new InvalidStakeTransition(existing.status, 'slashed');
  const updated: IntentStake = {
    ...existing,
    status: 'slashed',
    reason_if_slashed: reason,
    updated_at: new Date().toISOString(),
  };
  writeStake(updated);
  logEvent(
    'INTENT_STAKE_SLASHED',
    {
      stake_id: updated.stake_id,
      cluster_id: updated.cluster_id,
      amount_cents: updated.amount_cents,
      reason,
    },
    { actor_id: updated.actor_id },
  );
  return updated;
}

export function releaseStake(stake_id: string): IntentStake {
  const existing = loadStake(stake_id);
  if (!existing) throw new StakeNotFound(stake_id);
  if (existing.status !== 'active') throw new InvalidStakeTransition(existing.status, 'released');
  const updated: IntentStake = {
    ...existing,
    status: 'released',
    updated_at: new Date().toISOString(),
  };
  writeStake(updated);
  return updated;
}

export class StakeNotFound extends Error {
  stake_id: string;
  constructor(stake_id: string) {
    super(`stake_not_found: ${stake_id}`);
    this.name = 'StakeNotFound';
    this.stake_id = stake_id;
  }
}

export class InvalidStakeTransition extends Error {
  from: IntentStakeStatus;
  to: IntentStakeStatus;
  constructor(from: IntentStakeStatus, to: IntentStakeStatus) {
    super(`invalid_stake_transition: ${from} -> ${to}`);
    this.name = 'InvalidStakeTransition';
    this.from = from;
    this.to = to;
  }
}

export class InvalidStakeAmount extends Error {
  amount_cents: number;
  constructor(amount_cents: number) {
    super(`invalid_stake_amount: ${amount_cents}`);
    this.name = 'InvalidStakeAmount';
    this.amount_cents = amount_cents;
  }
}
