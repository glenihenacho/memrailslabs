import { describe, it, expect } from 'vitest';
import { grepLayer } from '@/lib/memory/grep';
import { loadCorpus } from '@/lib/memory/corpus';

describe('L1 grep', () => {
  const corpus = loadCorpus({ force: true });

  it('finds packet contract by literal phrase', () => {
    const result = grepLayer('packet contract', corpus);
    expect(result.resolved).toBe(true);
    expect(result.candidates.some((c) => c.id === 'clm_packet_contract')).toBe(true);
  });

  it('returns unresolved with empty query', () => {
    const result = grepLayer('   ', corpus);
    expect(result.resolved).toBe(false);
    expect(result.candidates).toHaveLength(0);
  });

  it('returns unresolved for words that do not appear literally', () => {
    const result = grepLayer('zzz-not-in-any-claim-zzz', corpus);
    expect(result.resolved).toBe(false);
  });
});
