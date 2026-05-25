import { describe, it, expect } from 'vitest';
import { compressLayer, estimateTokens } from '@/lib/memory/compress';
import type { EvidenceClaim } from '@/types/evidence';

function claim(over: Partial<EvidenceClaim>): EvidenceClaim {
  return {
    id: 'clm_test',
    source_file: 'knowledge/claims/test.md',
    claim: 'a test claim',
    confidence: 0.9,
    tags: [],
    created_at: '2026-05-25',
    updated_at: '2026-05-25',
    ...over,
  };
}

describe('L5 compress', () => {
  it('respects the max-token budget by clamping', () => {
    const longClaim = claim({ claim: 'x'.repeat(4000), confidence: 0.95 });
    const { packet, tokens } = compressLayer('long query', [longClaim], 100);
    expect(tokens).toBeLessThanOrEqual(120); // small headroom for the trailing ellipsis
    expect(packet.endsWith('…')).toBe(true);
  });

  it('tags the packet [uncertain] when every claim is below 0.85', () => {
    const candidates = [
      claim({ id: 'clm_a', confidence: 0.78 }),
      claim({ id: 'clm_b', confidence: 0.8 }),
    ];
    const { packet } = compressLayer('q', candidates);
    expect(packet).toMatch(/\[uncertain\]/);
  });

  it('does not tag [uncertain] when at least one claim clears 0.85', () => {
    const candidates = [
      claim({ id: 'clm_high', confidence: 0.95 }),
      claim({ id: 'clm_low', confidence: 0.78 }),
    ];
    const { packet } = compressLayer('q', candidates);
    expect(packet).not.toMatch(/\[uncertain\]/);
  });

  it('returns a labelled fallback when no evidence is available', () => {
    const { packet, compressor } = compressLayer('q', []);
    expect(packet).toMatch(/\[uncertain\]/);
    expect(packet).toMatch(/No evidence/);
    expect(compressor).toBe('compress-v1-stub');
  });

  it('estimateTokens roughly tracks character count', () => {
    expect(estimateTokens('')).toBe(0);
    expect(estimateTokens('x'.repeat(40))).toBe(10);
  });
});
