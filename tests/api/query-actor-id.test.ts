import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { POST } from '@/app/api/memory/query/route';
import { readAllEvents } from '@/lib/ledger/jsonl';

let dataDir: string;
const originalDataDir = process.env.DATA_DIR;

beforeEach(() => {
  dataDir = mkdtempSync(join(tmpdir(), 'memrails-query-actor-'));
  process.env.DATA_DIR = dataDir;
});

afterEach(() => {
  if (originalDataDir === undefined) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = originalDataDir;
  if (existsSync(dataDir)) rmSync(dataDir, { recursive: true, force: true });
});

async function postQuery(body: object, headers: Record<string, string> = {}): Promise<Response> {
  return POST(
    new Request('http://localhost/api/memory/query', {
      method: 'POST',
      headers: { 'content-type': 'application/json', ...headers },
      body: JSON.stringify(body),
    }),
  );
}

function intentObservedActor(): string | undefined {
  const evt = readAllEvents().find((e) => e.event_type === 'INTENT_OBSERVED');
  return evt?.actor_id;
}

describe('POST /api/memory/query — actor_id threading', () => {
  it('honors the x-memrails-actor-id header', async () => {
    const res = await postQuery(
      { query: 'what is the packet contract?' },
      { 'x-memrails-actor-id': 'gh_user_99' },
    );
    expect(res.status).toBe(200);
    expect(intentObservedActor()).toBe('gh_user_99');
  });

  it('falls back to body actor_id when no header is set', async () => {
    const res = await postQuery({ query: 'evidence floor', actor_id: 'body_actor' });
    expect(res.status).toBe(200);
    expect(intentObservedActor()).toBe('body_actor');
  });

  it('header overrides body', async () => {
    const res = await postQuery(
      { query: 'compress packets', actor_id: 'body_actor' },
      { 'x-memrails-actor-id': 'header_actor' },
    );
    expect(res.status).toBe(200);
    expect(intentObservedActor()).toBe('header_actor');
  });

  it('generates an anonymous fingerprint when neither header nor body sets it', async () => {
    const res = await postQuery({ query: 'contradictions' });
    expect(res.status).toBe(200);
    expect(intentObservedActor()).toMatch(/^anon_[0-9a-f]{12}$/);
  });
});
