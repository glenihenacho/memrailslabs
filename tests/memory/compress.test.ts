import { describe, it, expect } from 'vitest';
import { compressLayer, estimateTokens } from '@/lib/memory/compress';
import type { EvidenceClaim } from '@/types/evidence';

function claim(id: string, confidence: number, text = `claim ${id}`): EvidenceClaim {
  return {
    id,
    source_file: `knowledge/${id}.md`,
    claim: text,
    confidence,
    tags: [],
    created_at: '2026-05-25',
    updated_at: '2026-05-25',
  };
}

describe('L5 compress', () => {
  it('explains the empty-evidence case without inventing claims', () => {
    const { packet, compressor } = compressLayer('mystery', []);
    expect(packet).toContain('No evidence above the confidence floor');
    expect(compressor).toBe('compress-v1-stub');
  });

  it('cites claim ids and source files for each finding', () => {
    const { packet } = compressLayer('q', [claim('clm_a', 0.9)]);
    expect(packet).toContain('clm_a');
    expect(packet).toContain('knowledge/clm_a.md');
  });

  it('tags low-coverage answers as uncertain', () => {
    const { packet } = compressLayer('q', [claim('clm_a', 0.8), claim('clm_b', 0.8)]);
    expect(packet).toContain('[uncertain]');
  });

  it('never exceeds the token budget, even with the uncertainty note', () => {
    const many = Array.from({ length: 8 }, (_, i) =>
      claim(`clm_${i}`, 0.8, `a fairly long low-confidence claim number ${i} `.repeat(6)),
    );
    const maxTokens = 120;
    const { packet } = compressLayer('q', many, maxTokens);
    expect(estimateTokens(packet)).toBeLessThanOrEqual(maxTokens);
  });
});
