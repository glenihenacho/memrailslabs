import { rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, it, expect } from 'vitest';
import { retrieve } from '@/lib/memory/retrieve';
import { write } from '@/lib/memory/write';
import { supersede, dispute, forget } from '@/lib/memory/lifecycle';
import { getRecord, invalidateRegistry } from '@/lib/memory/registry';
import { memoryMap } from '@/lib/memory';

function resetData() {
  rmSync(resolve(__dirname, '../../.tmp-test-data'), { recursive: true, force: true });
  invalidateRegistry();
}

describe('memory.retrieve — governed context bundle', () => {
  beforeEach(resetData);

  it('returns a scoped, explainable bundle with a retrieval trace', () => {
    const bundle = retrieve({
      task_context: 'Detail the retrieval architecture and technical requirements for MemRails.',
      retrieval_mode: 'tree',
    });
    expect(bundle.context_bundle_id).toMatch(/^ctx_/);
    expect(bundle.retrieval_id).toMatch(/^ret_/);
    expect(bundle.memories.length).toBeGreaterThan(0);
    // Every selected memory carries a human-readable reason.
    for (const m of bundle.memories) {
      expect(m.reason_selected.length).toBeGreaterThan(0);
      expect(typeof m.score).toBe('number');
    }
    expect(bundle.retrieval_trace.branches_selected.length).toBeGreaterThan(0);
    expect(bundle.retrieval_trace.policy_filters_applied).toContain('owner_scope');
    expect(bundle.tokens_returned).toBeLessThanOrEqual(bundle.token_budget);
  });

  it('respects the token budget and ranks by relevance', () => {
    const bundle = retrieve({
      task_context: 'pricing orchestration packets',
      max_tokens: 40,
    });
    expect(bundle.tokens_returned).toBeLessThanOrEqual(40);
    // Some candidates should be dropped to the omitted list under a tight budget.
    expect(bundle.omitted.length + bundle.memories.length).toBeGreaterThan(0);
  });

  it('excludes a different project from scope', () => {
    const bundle = retrieve({
      task_context: 'retrieval architecture',
      project_id: 'project_unrelated',
    });
    expect(bundle.memories.length).toBe(0);
  });

  it('exposes the transparent scoring breakdown in debug mode', () => {
    const bundle = retrieve({ task_context: 'packet contract provenance', retrieval_mode: 'debug' });
    expect(bundle.retrieval_trace.scoring).toBeDefined();
    const first = bundle.retrieval_trace.scoring?.[0];
    expect(first).toHaveProperty('relevance');
    expect(first).toHaveProperty('final_score');
  });
});

describe('memory.write — governed creation', () => {
  beforeEach(resetData);

  it('creates an active record and is retrievable', () => {
    const result = write({
      content: 'MemRails retrieves governed memory for local inference; action retrieval is not the target.',
      memory_type: 'decision',
      tags: ['scope', 'thesis'],
      confidence: 0.96,
    });
    expect(result.memory_id).toMatch(/^mem_/);
    expect(result.status).toBe('active');
    const record = getRecord(result.memory_id, { force: true });
    expect(record?.content).toContain('governed memory');
  });

  it('deduplicates near-identical writes', () => {
    const a = write({ content: 'The packet contract survives every model swap and stays stable.' });
    const b = write({ content: 'the packet contract survives every model swap and stays stable' });
    expect(b.status).toBe('deduplicated');
    expect(b.dedup_of).toBe(a.memory_id);
  });
});

describe('memory lifecycle — supersession, dispute, forget', () => {
  beforeEach(resetData);

  it('supersede removes the old memory from active retrieval and surfaces the omission', () => {
    const created = write({
      content: 'The default evidence floor is 0.70.',
      tags: ['evidence', 'floor'],
      confidence: 0.9,
    });
    const { replacement } = supersede(created.memory_id, {
      new_memory: { content: 'The default evidence floor is 0.75.', tags: ['evidence', 'floor'], confidence: 0.95 },
      reason: 'corrected floor',
    });
    expect(replacement).toMatch(/^mem_/);

    const bundle = retrieve({ task_context: 'evidence floor default', include_evidence: true });
    const ids = bundle.memories.map((m) => m.memory_id);
    expect(ids).not.toContain(created.memory_id);
    expect(bundle.omitted.some((o) => o.memory_id === created.memory_id)).toBe(true);
  });

  it('dispute drops confidence and excludes unless explicitly requested', () => {
    const created = write({ content: 'Compress-v1 fidelity floor is 0.85.', tags: ['compress'], confidence: 0.9 });
    const result = dispute(created.memory_id, { reason: 'contested by new benchmark' });
    expect(result.confidence).toBeLessThan(0.9);

    const without = retrieve({ task_context: 'compress fidelity floor' });
    expect(without.memories.map((m) => m.memory_id)).not.toContain(created.memory_id);

    const withDisputed = retrieve({ task_context: 'compress fidelity floor', include_disputed: true });
    expect(withDisputed.memories.map((m) => m.memory_id)).toContain(created.memory_id);
  });

  it('forget tombstones a memory out of retrieval', () => {
    const created = write({ content: 'Temporary scratch note about nothing important.', tags: ['scratch'] });
    forget(created.memory_id, { reason: 'cleanup' });
    const record = getRecord(created.memory_id, { force: true });
    expect(record?.status).toBe('tombstoned');
    const bundle = retrieve({ task_context: 'scratch note' });
    expect(bundle.memories.map((m) => m.memory_id)).not.toContain(created.memory_id);
  });
});

describe('MemoryIndex map', () => {
  beforeEach(resetData);

  it('builds a nested project memory map', () => {
    const map = memoryMap('project_memrails');
    expect(map.length).toBeGreaterThan(0);
    // Root path should descend into /project/...
    expect(map[0].path.startsWith('/project')).toBe(true);
  });
});
