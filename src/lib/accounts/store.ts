import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { dataPath } from '@/lib/paths';
import { STARTER_RETRIEVAL_CREDITS } from '@/types/billing';
import { federation } from '@/lib/federation/accounts';

/**
 * Account / credit ledger.
 *
 * One account per owner, keyed by email. The free tier is **retrieval credits**,
 * not memory/agent/project caps (no arbitrary quotas — usage-based pricing
 * absorbs scale). Enrollment provisions an isolated tenant; the rail router
 * handles backend allocation invisibly.
 */

export type Plan = 'free' | 'usage' | 'team' | 'enterprise';

export type Account = {
  owner_id: string;
  email: string;
  plan: Plan;
  api_key_hash: string;
  credits_remaining: number;
  retrievals_total: number;
  spend_usd: number;
  created_at: string;
};

type AccountStore = Record<string, Account>;

function accountsFile(): string {
  return dataPath('accounts.json');
}

let cache: AccountStore | null = null;

function load(force = false): AccountStore {
  if (cache && !force) return cache;
  const path = accountsFile();
  if (!existsSync(path)) {
    cache = {};
    return cache;
  }
  try {
    cache = JSON.parse(readFileSync(path, 'utf8')) as AccountStore;
  } catch {
    cache = {};
  }
  return cache;
}

function save(store: AccountStore): void {
  const path = accountsFile();
  if (!existsSync(dirname(path))) mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(store, null, 2)}\n`, 'utf8');
  cache = store;
}

/** Stable owner id derived from email so re-enrollment is idempotent. */
export function ownerIdForEmail(email: string): string {
  const slug = createHash('sha256').update(email.trim().toLowerCase()).digest('hex').slice(0, 12);
  return `user_${slug}`;
}

export type EnrollResult = { owner_id: string; email: string; plan: Plan; api_key: string; credits_remaining: number };

/** Provision (or return) an isolated tenant for an email. */
export function enroll(email: string, plan: Plan = 'free'): EnrollResult {
  const store = load(true);
  const owner_id = ownerIdForEmail(email);
  const existing = store[owner_id];
  if (existing) {
    return {
      owner_id,
      email: existing.email,
      plan: existing.plan,
      api_key: '(existing — rotate via dashboard)',
      credits_remaining: existing.credits_remaining,
    };
  }
  const api_key = `mr_${randomUUID().replace(/-/g, '')}`;
  const account: Account = {
    owner_id,
    email: email.trim().toLowerCase(),
    plan,
    api_key_hash: createHash('sha256').update(api_key).digest('hex'),
    credits_remaining: plan === 'free' ? STARTER_RETRIEVAL_CREDITS : Number.POSITIVE_INFINITY,
    retrievals_total: 0,
    spend_usd: 0,
    created_at: new Date().toISOString(),
  };
  store[owner_id] = account;
  save(store);
  federation.provision(owner_id); // allocate the owner's NoSQL account namespace
  return { owner_id, email: account.email, plan, api_key, credits_remaining: account.credits_remaining };
}

/** Ensure an account exists (the default tenant is auto-provisioned). */
export function ensureAccount(owner_id: string): Account {
  const store = load();
  if (store[owner_id]) return store[owner_id];
  const account: Account = {
    owner_id,
    email: `${owner_id}@local`,
    plan: 'free',
    api_key_hash: '',
    credits_remaining: STARTER_RETRIEVAL_CREDITS,
    retrievals_total: 0,
    spend_usd: 0,
    created_at: new Date().toISOString(),
  };
  store[owner_id] = account;
  save(store);
  federation.provision(owner_id); // allocate the owner's NoSQL account namespace
  return account;
}

export function getAccount(owner_id: string): Account | null {
  return load()[owner_id] ?? null;
}

/**
 * Debit billable units and record spend. Credits can go negative for free
 * accounts — gating is a deploy policy (guardrail), not a hard cap baked into
 * the meter. Returns the post-debit balance and whether credits were exhausted.
 */
export function debit(owner_id: string, units: number, priceUsd: number): { credits_remaining: number; exhausted: boolean } {
  const store = load(true);
  const account = store[owner_id] ?? ensureAccount(owner_id);
  const before = account.credits_remaining;
  if (Number.isFinite(before)) account.credits_remaining = before - units;
  account.retrievals_total += 1;
  account.spend_usd = Number((account.spend_usd + priceUsd).toFixed(6));
  store[owner_id] = account;
  save(store);
  return {
    credits_remaining: account.credits_remaining,
    exhausted: Number.isFinite(account.credits_remaining) && account.credits_remaining <= 0,
  };
}

export function invalidateAccounts(): void {
  cache = null;
}
