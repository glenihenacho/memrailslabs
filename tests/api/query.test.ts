import { describe, it, expect } from 'vitest';
import { POST } from '@/app/api/memory/query/route';

function makeRequest(body: string, headers: Record<string, string> = {}): Request {
  return new Request('http://localhost/api/memory/query', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'content-length': String(Buffer.byteLength(body)),
      ...headers,
    },
    body,
  });
}

describe('POST /api/memory/query', () => {
  it('returns a packet on a valid query', async () => {
    const res = await POST(
      makeRequest(JSON.stringify({ query: 'what is the packet contract?', intent: 'answer' })),
    );
    expect(res.status).toBe(200);
    const packet = (await res.json()) as {
      packet_id: string;
      evidence: unknown[];
      input_hash: string;
      output_hash: string;
    };
    expect(packet.packet_id).toMatch(/^pkt_/);
    expect(packet.evidence.length).toBeGreaterThan(0);
    expect(packet.input_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(packet.output_hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('400s on malformed JSON', async () => {
    const res = await POST(makeRequest('not json at all'));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('invalid_json');
  });

  it('400s on missing required fields', async () => {
    const res = await POST(makeRequest(JSON.stringify({})));
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string; issues: unknown[] };
    expect(body.error).toBe('invalid_input');
    expect(body.issues.length).toBeGreaterThan(0);
  });

  it('400s on invalid intent enum', async () => {
    const res = await POST(
      makeRequest(JSON.stringify({ query: 'hi', intent: 'not_a_real_intent' })),
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('invalid_input');
  });

  it('413s on oversized payload', async () => {
    const big = JSON.stringify({ query: 'x' });
    const res = await POST(makeRequest(big, { 'content-length': String(100_000) }));
    expect(res.status).toBe(413);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('payload_too_large');
  });
});
