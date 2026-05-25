import { describe, it, expect } from 'vitest';
import { buildPacket } from '@/lib/memory/packet';
import type { EvidenceClaim } from '@/types/evidence';

const sampleClaim: EvidenceClaim = {
  id: 'clm_test',
  source_file: 'knowledge/test.md',
  claim: 'test claim',
  confidence: 0.9,
  tags: ['test'],
  created_at: '2026-05-25',
  updated_at: '2026-05-25',
};

describe('buildPacket', () => {
  it('includes provenance, hashes, confidence', () => {
    const packet = buildPacket({
      query: 'q',
      intent: 'answer',
      body: 'hello',
      candidates: [sampleClaim],
      resolved_layer: 'L1_GREP',
      model_or_compressor: 'retrieval-only',
    });
    expect(packet.confidence).toBe(0.9);
    expect(packet.evidence[0].claim_id).toBe('clm_test');
    expect(packet.evidence[0].weight).toBe(1);
    expect(packet.input_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(packet.output_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(packet.tokens).toBeGreaterThan(0);
  });

  it('handles zero candidates without dividing by zero', () => {
    const packet = buildPacket({
      query: 'q',
      intent: 'answer',
      body: 'nothing',
      candidates: [],
      resolved_layer: 'L1_GREP',
      model_or_compressor: 'retrieval-only',
    });
    expect(packet.confidence).toBe(0);
    expect(packet.evidence).toHaveLength(0);
  });
});
