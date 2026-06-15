import { rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, it, expect } from 'vitest';
import { RAILS, coreRails, railsByScope, getRail } from '@/lib/rails/registry';
import { HotRail, hotRetrievals } from '@/lib/rails/hot';
import { artifactRail } from '@/lib/rails/artifact';

function resetData() {
  rmSync(resolve(__dirname, '../../.tmp-test-data'), { recursive: true, force: true });
  hotRetrievals.clear();
}

describe('canonical rail registry', () => {
  it('defines the V1 core as Postgres + MemoryIndex + Redis + R2 + telemetry', () => {
    const core = coreRails().map((r) => r.id).sort();
    expect(core).toEqual(['artifact', 'authority', 'hot', 'retrieval', 'telemetry']);
  });

  it('keeps authority, telemetry, and analytics on the global plane', () => {
    expect(getRail('authority')?.scope).toBe('global');
    expect(getRail('telemetry')?.scope).toBe('global');
    expect(getRail('analytics')?.scope).toBe('global');
  });

  it('keeps the federation (artifact/document) per-owner', () => {
    const perOwner = railsByScope('per_owner').map((r) => r.id);
    expect(perOwner).toContain('artifact');
    expect(perOwner).toContain('document');
  });

  it('marks every v2 rail planned with an add_when trigger', () => {
    for (const rail of RAILS.filter((r) => r.tier === 'v2')) {
      expect(rail.status).toBe('planned');
      expect(rail.add_when).toBeTruthy();
    }
  });
});

describe('Hot Rail (LRU)', () => {
  it('returns warm values and evicts the oldest past capacity', () => {
    const hot = new HotRail<number>(2);
    hot.set('a', 1);
    hot.set('b', 2);
    expect(hot.get('a')).toBe(1); // refreshes recency of a
    hot.set('c', 3); // evicts b (oldest)
    expect(hot.has('b')).toBe(false);
    expect(hot.get('a')).toBe(1);
    expect(hot.get('c')).toBe(3);
  });
});

describe('Artifact Rail', () => {
  beforeEach(resetData);

  it('round-trips an artifact by ref, namespaced per owner', () => {
    const ref = artifactRail.put('user_demo', 'snapshot.json', '{"ok":true}');
    expect(ref).toMatch(/^artifact:\/\/user_demo\//);
    expect(artifactRail.get(ref)).toBe('{"ok":true}');
    expect(artifactRail.get('artifact://user_demo/missing.json')).toBeNull();
  });
});
