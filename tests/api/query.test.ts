import { describe, it, expect } from 'vitest';
import { POST } from '@/app/api/memory/query/route';
import { authorizeSession } from '@/lib/payments/sessions';
import { deployEndpoint, closeEndpoint } from '@/lib/endpoints/deploy';

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

  it('402s when the supplied session is exhausted', async () => {
    const session = authorizeSession({ budget_cents: 0.04, rail: 'stripe_card' });
    const res = await POST(
      makeRequest(
        JSON.stringify({
          query: 'what is the packet contract?',
          session_id: session.session_id,
        }),
      ),
    );
    expect(res.status).toBe(402);
    const body = (await res.json()) as { error: string; reason: string; session_id: string };
    expect(body.error).toBe('payment_required');
    expect(body.session_id).toBe(session.session_id);
    expect(body.reason).toBe('insufficient_budget');
  });

  it('debits an authorized session and returns the packet', async () => {
    const session = authorizeSession({ budget_cents: 5, rail: 'lightning' });
    const res = await POST(
      makeRequest(
        JSON.stringify({
          query: 'what is the packet contract?',
          session_id: session.session_id,
        }),
      ),
    );
    expect(res.status).toBe(200);
    const packet = (await res.json()) as { packet_id: string };
    expect(packet.packet_id).toMatch(/^pkt_/);
  });

  it('409s when the endpoint is closed', async () => {
    const ep = await deployEndpoint();
    closeEndpoint(ep.endpoint_id);
    const res = await POST(
      makeRequest(
        JSON.stringify({
          query: 'what is the packet contract?',
          endpoint_id: ep.endpoint_id,
        }),
      ),
    );
    expect(res.status).toBe(409);
    const body = (await res.json()) as {
      error: string;
      endpoint_id: string;
      status: string;
    };
    expect(body.error).toBe('endpoint_not_live');
    expect(body.endpoint_id).toBe(ep.endpoint_id);
    expect(body.status).toBe('closed');
  });

  it('409s when the endpoint is unknown', async () => {
    const res = await POST(
      makeRequest(
        JSON.stringify({
          query: 'what is the packet contract?',
          endpoint_id: 'ep_doesnotexist',
        }),
      ),
    );
    expect(res.status).toBe(409);
    const body = (await res.json()) as { error: string; endpoint_id: string };
    expect(body.error).toBe('endpoint_not_found');
    expect(body.endpoint_id).toBe('ep_doesnotexist');
  });

  it('routes a query through a live endpoint and tags the packet', async () => {
    const ep = await deployEndpoint();
    const res = await POST(
      makeRequest(
        JSON.stringify({
          query: 'what is the packet contract?',
          endpoint_id: ep.endpoint_id,
        }),
      ),
    );
    expect(res.status).toBe(200);
    const packet = (await res.json()) as { packet_id: string };
    expect(packet.packet_id).toMatch(/^pkt_/);
  });
});
