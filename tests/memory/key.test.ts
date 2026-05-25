import { describe, it, expect } from 'vitest';
import { keyLayer } from '@/lib/memory/key';
import { loadCorpus } from '@/lib/memory/corpus';

describe('L2 key', () => {
  const corpus = loadCorpus({ force: true });

  it('resolves an alias', () => {
    const result = keyLayer('packet contract', corpus);
    expect(result.resolved).toBe(true);
    expect(result.candidates.some((c) => c.id === 'clm_packet_contract')).toBe(true);
  });

  it('resolves a tag', () => {
    const result = keyLayer('pricing', corpus);
    expect(result.resolved).toBe(true);
    expect(result.candidates.some((c) => c.id === 'clm_pricing')).toBe(true);
  });

  it('does not resolve unrelated input', () => {
    const result = keyLayer('quokka kebab', corpus);
    expect(result.resolved).toBe(false);
  });
});
