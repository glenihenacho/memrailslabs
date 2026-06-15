import { rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, it, expect } from 'vitest';
import { retrieve } from '@/lib/memory/retrieve';
import { write } from '@/lib/memory/write';
import { enroll, invalidateAccounts } from '@/lib/accounts/store';
import { invalidateRegistry } from '@/lib/memory/registry';
import { resetRetrievalCache } from '@/lib/memory/cache';

function resetAll() {
  rmSync(resolve(__dirname, '../../.tmp-test-data'), { recursive: true, force: true });
  invalidateRegistry();
  invalidateAccounts();
  resetRetrievalCache();
}

describe('rigorous grep short-circuit', () => {
  beforeEach(resetAll);

  it('resolves at L1 and skips the semantic blend on strong literal evidence', () => {
    const acct = enroll('grep@example.com');
    write({
      owner_id: acct.owner_id,
      content: 'alpha bravo charlie delta echo',
      tags: ['x'],
      confidence: 0.9,
      index_path: '/project/project_memrails/x',
    });

    const bundle = retrieve({
      task_context: 'alpha bravo charlie delta echo',
      owner_id: acct.owner_id,
      retrieval_mode: 'debug',
    });

    expect(bundle.retrieval_trace.resolved_layer).toBe('L1_GREP');
    expect(bundle.retrieval_trace.semantic_skipped).toBe(true);
    expect(bundle.retrieval_trace.branches_selected).toHaveLength(0);
    expect(bundle.memories.length).toBeGreaterThan(0);
    // Semantic signal is genuinely skipped, not just zero by coincidence.
    expect(bundle.retrieval_trace.scoring?.[0]?.relevance_signals?.semantic).toBe(0);
  });

  it('does not skip semantic when literal evidence is weak (morphological variant)', () => {
    const acct = enroll('weak@example.com');
    write({
      owner_id: acct.owner_id,
      content: 'governed retrieval pipeline ranks memory',
      tags: ['x'],
      confidence: 0.9,
      index_path: '/project/project_memrails/x',
    });

    const bundle = retrieve({
      task_context: 'retrieving governed memories',
      owner_id: acct.owner_id,
      retrieval_mode: 'debug',
    });

    expect(bundle.retrieval_trace.semantic_skipped).toBe(false);
    expect(bundle.retrieval_trace.resolved_layer).toBe('L3_SEMANTIC');
  });

  it('adapts the threshold from cache-hit history: a repeat flips to grep', () => {
    const acct = enroll('adaptive@example.com');
    write({
      owner_id: acct.owner_id,
      content: 'alpha bravo charlie',
      tags: ['x'],
      confidence: 0.9,
      index_path: '/project/project_memrails/x',
    });

    // Coverage = 3/4 = 0.75. Cold bar is 0.9 → semantic path on first sight.
    const query = {
      task_context: 'alpha bravo charlie delta',
      owner_id: acct.owner_id,
      retrieval_mode: 'debug' as const,
    };

    const first = retrieve(query);
    expect(first.retrieval_trace.cache_hit_rate).toBe(0);
    expect(first.retrieval_trace.semantic_skipped).toBe(false);

    // Repeat: the signature is warm, hit rate rises, the grep bar drops to 0.75,
    // so the same literal evidence now resolves at L1 and skips semantic.
    const second = retrieve(query);
    expect(second.retrieval_trace.cache_hit_rate).toBeGreaterThan(0);
    expect(second.retrieval_trace.grep_threshold).toBeLessThanOrEqual(0.75);
    expect(second.retrieval_trace.semantic_skipped).toBe(true);
    expect(second.retrieval_trace.resolved_layer).toBe('L1_GREP');
  });
});
