import { describe, it, expect } from 'vitest';
import { query } from '@/lib/memory';

describe('memory.query orchestrator', () => {
  it('returns a packet with provenance, hashes, and confidence', async () => {
    const packet = await query({
      query: 'what is the packet contract?',
      intent: 'answer',
    });
    expect(packet.packet_id).toMatch(/^pkt_/);
    expect(packet.evidence.length).toBeGreaterThan(0);
    expect(packet.evidence[0].claim_id).toMatch(/^clm_/);
    expect(packet.input_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(packet.output_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(packet.confidence).toBeGreaterThan(0);
    expect(['L1_GREP', 'L2_KEY', 'L3_SEMANTIC', 'L4_EVIDENCE', 'L5_COMPRESS']).toContain(
      packet.resolved_layer,
    );
  });

  it('caps packet tokens around the requested ceiling', async () => {
    const packet = await query({
      query: 'pricing',
      intent: 'summarize',
      max_tokens: 200,
    });
    // Stub compressor clamps to maxTokens; allow some headroom for trailing notes.
    expect(packet.tokens).toBeLessThanOrEqual(300);
  });
});
