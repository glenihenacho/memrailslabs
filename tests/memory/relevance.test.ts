import { rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, it, expect } from 'vitest';
import { retrieve } from '@/lib/memory/retrieve';
import { write } from '@/lib/memory/write';
import { invalidateRegistry } from '@/lib/memory/registry';
import { resetRetrievalCache } from '@/lib/memory/cache';

function resetData() {
  rmSync(resolve(__dirname, '../../.tmp-test-data'), { recursive: true, force: true });
  invalidateRegistry();
  resetRetrievalCache();
}

describe('governed relevance — evolved L1–L3 blend', () => {
  beforeEach(resetData);

  it('retrieves on morphological variants the raw tokenizer would miss', () => {
    // Query words never appear verbatim in memory: "retrieving" vs "retrieval",
    // "prices" vs "pricing". Stemming is what makes this match.
    const bundle = retrieve({
      task_context: 'retrieving the prices for governed memory',
      retrieval_mode: 'debug',
    });
    expect(bundle.memories.length).toBeGreaterThan(0);

    const top = bundle.retrieval_trace.scoring?.[0];
    expect(top?.relevance_signals).toBeDefined();
    expect(top?.relevance_signals?.semantic).toBeGreaterThan(0);
  });

  it('exposes per-layer signals (lexical / structural / semantic) in the trace', () => {
    const bundle = retrieve({ task_context: 'pricing', retrieval_mode: 'debug' });
    const sig = bundle.retrieval_trace.scoring?.[0]?.relevance_signals;
    expect(sig).toHaveProperty('lexical');
    expect(sig).toHaveProperty('structural');
    expect(sig).toHaveProperty('semantic');
  });

  it('drops a zero-signal branch member via the L4 relevance floor', () => {
    // Two memories share a neutral branch (so both are candidates), but only one
    // shares any term with the query. The other has zero lexical, structural,
    // and semantic signal — the L4 floor should gate it out.
    write({
      content: 'Deployment uses a blue green canary rollout.',
      tags: ['deploy'],
      index_path: '/project/project_memrails/scratch_notes',
      confidence: 0.9,
    });
    write({
      content: 'Sea otters hold hands while sleeping.',
      tags: ['trivia'],
      index_path: '/project/project_memrails/scratch_notes',
      confidence: 0.99, // high confidence must not rescue an irrelevant memory
    });

    // A morphological-variant query (deploying ~ deployment, rollouts ~ rollout)
    // doesn't clear the literal grep bar, so the tree path runs and the L4 floor
    // applies to the branch members.
    const bundle = retrieve({ task_context: 'deploying the blue green rollouts' });
    const summaries = bundle.memories.map((m) => m.summary).join(' ');
    expect(summaries).toContain('canary');
    expect(summaries).not.toContain('otters');
    expect(bundle.omitted.some((o) => o.reason.includes('relevance signal'))).toBe(true);
  });
});
