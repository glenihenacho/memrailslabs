import { describe, it, expect } from 'vitest';
import { handleQuery, handleInspect, handleWrite } from '@/lib/mcp/tools';
import type { MemoryPacket } from '@/types/packet';
import type { EvidenceClaim } from '@/types/evidence';

describe('memory.query MCP handler', () => {
  it('returns a packet payload as JSON text content', async () => {
    const result = await handleQuery({
      query: 'what is the packet contract?',
      intent: 'answer',
    });
    expect(result.isError).toBeFalsy();
    expect(result.content[0].type).toBe('text');
    const packet = JSON.parse(result.content[0].text) as MemoryPacket;
    expect(packet.packet_id).toMatch(/^pkt_/);
    expect(packet.evidence.length).toBeGreaterThan(0);
    expect(packet.input_hash).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe('memory.inspect MCP handler', () => {
  it('returns packet + full evidence bundle + provenance weights + hashes', async () => {
    const queryResult = await handleQuery({
      query: 'what is the packet contract?',
      intent: 'answer',
    });
    const packet = JSON.parse(queryResult.content[0].text) as MemoryPacket;

    const inspectResult = await handleInspect({ packet_id: packet.packet_id });
    expect(inspectResult.isError).toBeFalsy();

    const body = JSON.parse(inspectResult.content[0].text) as {
      packet: MemoryPacket;
      evidence_bundle: EvidenceClaim[];
      provenance_weights: Record<string, number>;
      hashes: { input_hash: string; output_hash: string };
    };

    expect(body.packet.packet_id).toBe(packet.packet_id);
    expect(body.evidence_bundle.length).toBe(packet.evidence.length);
    // Bundle contains full claim objects, not just ids.
    expect(body.evidence_bundle[0].claim).toBeTruthy();
    expect(body.evidence_bundle[0].source_file).toMatch(/\.md$/);
    expect(body.provenance_weights[packet.evidence[0].claim_id]).toBe(
      packet.evidence[0].weight,
    );
    expect(body.hashes.input_hash).toBe(packet.input_hash);
    expect(body.hashes.output_hash).toBe(packet.output_hash);
  });

  it('returns isError for unknown packet_id', async () => {
    const result = await handleInspect({ packet_id: 'pkt_does_not_exist' });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/packet_not_found/);
  });
});

describe('memory.write MCP handler', () => {
  it('returns the Phase-3 stub error', async () => {
    const result = await handleWrite({ claim: 'a proposed claim' });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/Phase 3/);
  });
});
