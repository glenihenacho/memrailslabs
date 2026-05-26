import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let workdir: string;
const originalCwd = process.cwd();

beforeEach(() => {
  workdir = mkdtempSync(join(tmpdir(), 'memrails-query-endpoint-'));
  cpSync(join(originalCwd, 'knowledge'), join(workdir, 'knowledge'), { recursive: true });
  mkdirSync(join(workdir, 'data', 'logs'), { recursive: true });
  mkdirSync(join(workdir, 'data', 'packets'), { recursive: true });
  mkdirSync(join(workdir, 'data', 'endpoints'), { recursive: true });
  process.chdir(workdir);
  vi.resetModules();
});

afterEach(() => {
  process.chdir(originalCwd);
  if (existsSync(workdir)) rmSync(workdir, { recursive: true, force: true });
});

async function freshMemory() {
  return (await import('@/lib/memory')) as typeof import('@/lib/memory');
}
async function freshDeploy() {
  return (await import('@/lib/endpoints/deploy')) as typeof import('@/lib/endpoints/deploy');
}
async function freshLedger() {
  return (await import('@/lib/ledger/jsonl')) as typeof import('@/lib/ledger/jsonl');
}

describe('query() with endpoint_id', () => {
  it('tags PACKET_CREATED and QUERY events with endpoint_id', async () => {
    const { query } = await freshMemory();
    const { deployEndpoint } = await freshDeploy();
    const { readAllEvents } = await freshLedger();

    const ep = await deployEndpoint();
    const packet = await query({
      query: 'what is the packet contract?',
      endpoint_id: ep.endpoint_id,
    });

    const events = readAllEvents();
    const created = events.find(
      (e) => e.event_type === 'PACKET_CREATED' && e.packet_id === packet.packet_id,
    );
    expect(created?.endpoint_id).toBe(ep.endpoint_id);
    const q = events.find(
      (e) => e.event_type === 'QUERY' && e.endpoint_id === ep.endpoint_id,
    );
    expect(q).toBeDefined();
  });

  it('throws EndpointNotFound for an unknown endpoint_id', async () => {
    const { query, EndpointNotFound } = await freshMemory();
    await expect(
      query({ query: 'x', endpoint_id: 'ep_doesnotexist' }),
    ).rejects.toBeInstanceOf(EndpointNotFound);
  });

  it('throws EndpointNotLive once the endpoint is closed', async () => {
    const { query, EndpointNotLive } = await freshMemory();
    const { deployEndpoint, closeEndpoint } = await freshDeploy();
    const ep = await deployEndpoint();
    closeEndpoint(ep.endpoint_id);
    await expect(
      query({ query: 'what is the packet contract?', endpoint_id: ep.endpoint_id }),
    ).rejects.toBeInstanceOf(EndpointNotLive);
  });
});

describe('query() without endpoint_id (regression)', () => {
  it('does not tag PACKET_CREATED with endpoint_id', async () => {
    const { query } = await freshMemory();
    const { readAllEvents } = await freshLedger();
    const packet = await query({ query: 'what is the packet contract?' });
    const created = readAllEvents().find(
      (e) => e.event_type === 'PACKET_CREATED' && e.packet_id === packet.packet_id,
    );
    expect(created?.endpoint_id).toBeUndefined();
  });
});
