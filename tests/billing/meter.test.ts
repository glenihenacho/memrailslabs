import { rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, it, expect } from 'vitest';
import { retrieve } from '@/lib/memory/retrieve';
import { invalidateRegistry } from '@/lib/memory/registry';
import { enroll, getAccount, ownerIdForEmail, invalidateAccounts } from '@/lib/accounts/store';
import { write } from '@/lib/memory/write';
import { federation } from '@/lib/federation/accounts';
import { calculateRetrievalCost } from '@/lib/pricing/calculator';

function resetData() {
  rmSync(resolve(__dirname, '../../.tmp-test-data'), { recursive: true, force: true });
  invalidateRegistry();
  invalidateAccounts();
}

describe('retrieval metering', () => {
  beforeEach(resetData);

  it('meters one successful retrieve as one billable retrieval', () => {
    const bundle = retrieve({ task_context: 'final memrails model and pricing' });
    expect(bundle.usage.billable_retrievals).toBe(1);
    expect(bundle.usage.billable_units).toBe(1); // v1 simple: 1 = 1
  });

  it('debits credits and accrues spend per retrieval', () => {
    const acct = enroll('founder@example.com');
    expect(acct.credits_remaining).toBe(2500);

    retrieve({ task_context: 'roadmap', owner_id: acct.owner_id });
    retrieve({ task_context: 'architecture', owner_id: acct.owner_id });

    const after = getAccount(acct.owner_id);
    expect(after?.retrievals_total).toBe(2);
    expect(after?.credits_remaining).toBe(2498);
    expect(after?.spend_usd).toBeCloseTo(0.004, 6);
  });

  it('rejects a path-traversal owner_id at the federation boundary', () => {
    expect(() => retrieve({ task_context: 'x', owner_id: '../../etc' })).toThrow();
  });

  it('enrollment is idempotent per email', () => {
    const a = enroll('dev@example.com');
    const b = enroll('dev@example.com');
    expect(a.owner_id).toBe(b.owner_id);
    expect(a.owner_id).toBe(ownerIdForEmail('dev@example.com'));
  });

  it('isolates tenants — a fresh account retrieves an empty namespace', () => {
    const acct = enroll('isolated@example.com');
    const bundle = retrieve({ task_context: 'retrieval architecture', owner_id: acct.owner_id });
    expect(bundle.memories.length).toBe(0);
    expect(bundle.usage.billable_retrievals).toBe(1); // still a billable event
  });
});

describe('federated NoSQL accounts — one namespace per owner', () => {
  beforeEach(resetData);

  it('provisions a namespace per owner and isolates memory physically', () => {
    const alice = enroll('alice@example.com');
    const bob = enroll('bob@example.com');

    write({ content: 'Alice prefers terse answers.', owner_id: alice.owner_id, memory_type: 'preference', tags: ['preference'] });
    write({ content: 'Bob prefers verbose answers.', owner_id: bob.owner_id, memory_type: 'preference', tags: ['preference'] });

    const aSees = retrieve({ task_context: 'user preference', owner_id: alice.owner_id });
    const bSees = retrieve({ task_context: 'user preference', owner_id: bob.owner_id });

    expect(aSees.memories.map((m) => m.summary).join()).toContain('Alice');
    expect(aSees.memories.map((m) => m.summary).join()).not.toContain('Bob');
    expect(bSees.memories.map((m) => m.summary).join()).toContain('Bob');

    const accounts = federation.list().map((a) => a.account_id);
    expect(accounts).toContain(`acct_${alice.owner_id}`);
    expect(accounts).toContain(`acct_${bob.owner_id}`);
  });
});

describe('retrieval pricing', () => {
  it('prices $2 per 1,000 retrievals', () => {
    expect(calculateRetrievalCost(1000)).toBe(2);
    expect(calculateRetrievalCost(1)).toBe(0.002);
    expect(calculateRetrievalCost(0)).toBe(0);
  });
});
