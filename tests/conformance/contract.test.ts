/**
 * Contract v0.1 conformance suite (knowledge/memrails-contract-v0.1.md).
 *
 * These tests run against the public interface — retrieve / write / lifecycle
 * — never the implementation, so they must pass unchanged as the backing
 * stores migrate (file-canonical → Postgres → rails; conversion phases
 * C0 → C7). If a change cannot keep this suite green, it is a contract change
 * and goes through a spec revision.
 */
import { beforeEach, describe, it, expect } from 'vitest';
import { resetData } from './helpers';
import { retrieve } from '@/lib/memory/retrieve';
import { write } from '@/lib/memory/write';
import { supersede, dispute, forget } from '@/lib/memory/lifecycle';
import type { RetrievalMode } from '@/types/bundle';

describe('contract §4 — governance invariants', () => {
  beforeEach(resetData);

  it('§4.2 rejects self-supersession', () => {
    const created = write({ content: 'The deploy target is Vercel.', tags: ['deploy'] });
    expect(() => supersede(created.memory_id, { new_memory_id: created.memory_id })).toThrow();
  });

  it('§4.3 supersession removes from retrieval and surfaces the omission with a reason', () => {
    const old = write({ content: 'Conformance floor is 0.70 for all evidence.', tags: ['floor'], confidence: 0.9 });
    supersede(old.memory_id, {
      new_memory: { content: 'Conformance floor is 0.75 for all evidence.', tags: ['floor'], confidence: 0.95 },
      reason: 'floor corrected',
    });
    const bundle = retrieve({ task_context: 'conformance floor evidence' });
    expect(bundle.memories.map((m) => m.memory_id)).not.toContain(old.memory_id);
    const omission = bundle.omitted.find((o) => o.memory_id === old.memory_id);
    expect(omission).toBeDefined();
    expect(omission!.reason.length).toBeGreaterThan(0);
  });

  it('§4.4 dispute excludes by default and returns only on explicit opt-in', () => {
    const created = write({ content: 'Compress fidelity threshold sits at 0.85.', tags: ['compress'], confidence: 0.9 });
    dispute(created.memory_id, { reason: 'contested' });
    expect(
      retrieve({ task_context: 'compress fidelity threshold' }).memories.map((m) => m.memory_id),
    ).not.toContain(created.memory_id);
    expect(
      retrieve({ task_context: 'compress fidelity threshold', include_disputed: true }).memories.map(
        (m) => m.memory_id,
      ),
    ).toContain(created.memory_id);
  });

  it('§4.5 tombstoned memory never appears in memories[], under any flag', () => {
    const created = write({ content: 'Ephemeral scratch fact to be forgotten.', tags: ['scratch'] });
    forget(created.memory_id, { reason: 'requested' });
    for (const flags of [{}, { include_disputed: true }, { include_evidence: true }]) {
      const bundle = retrieve({ task_context: 'ephemeral scratch fact forgotten', ...flags });
      expect(bundle.memories.map((m) => m.memory_id)).not.toContain(created.memory_id);
    }
  });
});

describe('contract §5 — retrieval guarantees', () => {
  beforeEach(resetData);

  const MODES: RetrievalMode[] = ['exact', 'tree', 'hybrid', 'hot', 'debug'];

  it('§5.1 every bundle carries a retrieval trace, in every mode', () => {
    for (const mode of MODES) {
      const bundle = retrieve({ task_context: 'retrieval architecture pipeline', retrieval_mode: mode });
      expect(bundle.retrieval_trace).toBeDefined();
      expect(bundle.retrieval_trace.mode).toBe(mode);
      expect(Array.isArray(bundle.retrieval_trace.branches_selected)).toBe(true);
      expect(bundle.retrieval_trace.policy_filters_applied.length).toBeGreaterThan(0);
      expect(typeof bundle.retrieval_trace.candidates_considered).toBe('number');
    }
  });

  it('§5.2 every omission carries a non-empty reason', () => {
    const old = write({ content: 'Old superseded governance statement.', tags: ['governance'], confidence: 0.9 });
    supersede(old.memory_id, {
      new_memory: { content: 'New governance statement replacing the old.', tags: ['governance'], confidence: 0.95 },
    });
    // Tiny budget forces budget omissions on top of the policy omission.
    const bundle = retrieve({ task_context: 'governance retrieval pricing packets architecture', max_tokens: 30 });
    expect(bundle.omitted.length).toBeGreaterThan(0);
    for (const o of bundle.omitted) {
      expect(o.memory_id.length).toBeGreaterThan(0);
      expect(o.reason.trim().length).toBeGreaterThan(0);
    }
  });

  it('§5.3 every selected memory carries a reason and a score', () => {
    const bundle = retrieve({ task_context: 'memory retrieval architecture' });
    expect(bundle.memories.length).toBeGreaterThan(0);
    for (const m of bundle.memories) {
      expect(m.reason_selected.trim().length).toBeGreaterThan(0);
      expect(typeof m.score).toBe('number');
    }
  });

  it('§5.4 restricted memory never leaves the runtime through retrieval', () => {
    const created = write({
      content: 'Restricted credential-adjacent memory that must never surface.',
      sensitivity: 'restricted',
      tags: ['secret'],
    });
    const bundle = retrieve({ task_context: 'restricted credential memory surface', include_disputed: true });
    expect(bundle.memories.map((m) => m.memory_id)).not.toContain(created.memory_id);
  });

  it('§5.5 synthesis filters at the 0.75 evidence floor', () => {
    const project_id = 'project_floor_conf';
    write({
      content: 'Low-confidence speculation about caching strategy.',
      project_id,
      confidence: 0.4,
      tags: ['caching'],
    });
    write({
      content: 'High-confidence decision: cache invalidation is event-driven.',
      project_id,
      confidence: 0.9,
      tags: ['caching'],
    });
    const bundle = retrieve({ task_context: 'caching strategy decision', project_id, include_packet: true });
    expect(bundle.packet).toBeDefined();
    const cited = bundle.packet!.evidence.map((e) => e.claim_id);
    const lowConf = bundle.memories.find((m) => m.confidence < 0.75);
    if (lowConf) expect(cited).not.toContain(lowConf.memory_id);
    expect(bundle.packet!.packet).not.toContain('speculation about caching');
  });

  it('§5.6 all-below-0.85 evidence yields an explicit [uncertain] label', () => {
    const project_id = 'project_uncertain_conf';
    write({
      content: 'Provisional finding: tree retrieval beats vector top-k on this corpus.',
      project_id,
      confidence: 0.78, // above floor, below the 0.85 certainty bar
      tags: ['finding'],
    });
    const bundle = retrieve({ task_context: 'tree retrieval finding', project_id, include_packet: true });
    expect(bundle.packet).toBeDefined();
    expect(bundle.packet!.packet).toContain('[uncertain]');
  });

  it('§5.7 the token budget is honored and overflow is explained', () => {
    const bundle = retrieve({ task_context: 'packets pricing retrieval architecture roadmap', max_tokens: 40 });
    // Carve-out (§5.7): the single top memory may alone exceed a tiny budget;
    // beyond it the budget binds and overflow is explained.
    if (bundle.memories.length > 1) {
      expect(bundle.tokens_returned).toBeLessThanOrEqual(bundle.token_budget);
    }
    expect(bundle.omitted.some((o) => o.reason.toLowerCase().includes('budget'))).toBe(true);

    // With a workable budget the inequality holds outright.
    const roomy = retrieve({ task_context: 'packets pricing retrieval architecture roadmap' });
    expect(roomy.tokens_returned).toBeLessThanOrEqual(roomy.token_budget);
  });

  it('§5.8 one successful retrieve meters as one billable retrieval', () => {
    const bundle = retrieve({ task_context: 'metering conformance check' });
    expect(bundle.usage.billable_retrievals).toBe(1);
  });
});
