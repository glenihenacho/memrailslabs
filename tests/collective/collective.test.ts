import { rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, it, expect } from 'vitest';
import { enroll, setCollectiveOptIn, isOptedIn, invalidateAccounts } from '@/lib/accounts/store';
import { write } from '@/lib/memory/write';
import { predictiveInsights, collectiveSize } from '@/lib/memory/collective';
import { invalidateRegistry } from '@/lib/memory/registry';

function reset() {
  rmSync(resolve(__dirname, '../../.tmp-test-data'), { recursive: true, force: true });
  invalidateRegistry();
  invalidateAccounts();
}

/** Enroll an owner, opt them in (or not), and seed tagged notes. */
function tenant(email: string, tags: string[], optIn = true): string {
  const { owner_id } = enroll(email);
  if (optIn) setCollectiveOptIn(owner_id, true);
  write({ content: `note for ${email}`, owner_id, tags });
  return owner_id;
}

describe('collective — consent + k-anonymous predictive insights', () => {
  beforeEach(reset);

  it('opt-in is server-authoritative and default off', () => {
    const { owner_id } = enroll('user@example.com');
    expect(isOptedIn(owner_id)).toBe(false);
    setCollectiveOptIn(owner_id, true);
    expect(isOptedIn(owner_id)).toBe(true);
  });

  it('predicts a topic backed by ≥3 distinct other tenants', () => {
    // 3 contributors all pair (alpha, beta)…
    tenant('a@x.com', ['alpha', 'beta']);
    tenant('b@x.com', ['alpha', 'beta']);
    tenant('c@x.com', ['alpha', 'beta']);
    // …caller has alpha but not beta.
    const caller = tenant('caller@x.com', ['alpha']);

    const insights = predictiveInsights(caller);
    expect(collectiveSize()).toBe(4);
    const beta = insights.find((i) => i.predicted_topic === 'beta');
    expect(beta).toBeDefined();
    expect(beta?.from_topic).toBe('alpha');
    expect(beta?.support).toBe(3); // distinct OTHER tenants, not the caller
    // Aggregate only — no foreign bodies, ids, or owners in the payload.
    expect(JSON.stringify(insights)).not.toMatch(/note for|owner_/);
  });

  it('suppresses signals below the k-anonymity threshold', () => {
    // Only 2 other tenants share (alpha, gamma) → below default minSupport 3.
    tenant('a@x.com', ['alpha', 'gamma']);
    tenant('b@x.com', ['alpha', 'gamma']);
    const caller = tenant('caller@x.com', ['alpha']);

    const insights = predictiveInsights(caller);
    expect(insights.find((i) => i.predicted_topic === 'gamma')).toBeUndefined();
  });

  it('excludes non-opted-in tenants from contributing', () => {
    tenant('a@x.com', ['alpha', 'beta']);
    tenant('b@x.com', ['alpha', 'beta']);
    // Opted-OUT tenant also has (alpha, beta) but must not count toward support.
    tenant('out@x.com', ['alpha', 'beta'], false);
    const caller = tenant('caller@x.com', ['alpha']);

    const insights = predictiveInsights(caller);
    // Only 2 opted-in contributors → below threshold, so no beta prediction.
    expect(insights.find((i) => i.predicted_topic === 'beta')).toBeUndefined();
  });

  it('returns nothing for a caller who has not opted in', () => {
    tenant('a@x.com', ['alpha', 'beta']);
    tenant('b@x.com', ['alpha', 'beta']);
    tenant('c@x.com', ['alpha', 'beta']);
    const { owner_id } = enroll('lurker@x.com'); // not opted in
    write({ content: 'x', owner_id, tags: ['alpha'] });

    expect(predictiveInsights(owner_id)).toEqual([]);
  });
});
