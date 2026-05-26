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
  workdir = mkdtempSync(join(tmpdir(), 'memrails-endpoints-'));
  cpSync(join(originalCwd, 'knowledge'), join(workdir, 'knowledge'), { recursive: true });
  mkdirSync(join(workdir, 'data', 'logs'), { recursive: true });
  mkdirSync(join(workdir, 'data', 'endpoints'), { recursive: true });
  process.chdir(workdir);
  vi.resetModules();
});

afterEach(() => {
  process.chdir(originalCwd);
  if (existsSync(workdir)) rmSync(workdir, { recursive: true, force: true });
});

async function freshDeploy() {
  return (await import('@/lib/endpoints/deploy')) as typeof import('@/lib/endpoints/deploy');
}

async function freshStore() {
  return (await import('@/lib/endpoints/store')) as typeof import('@/lib/endpoints/store');
}

async function freshLedger() {
  return (await import('@/lib/ledger/jsonl')) as typeof import('@/lib/ledger/jsonl');
}

describe('deployEndpoint', () => {
  it('runs all five stages and persists a live endpoint', async () => {
    const { deployEndpoint } = await freshDeploy();
    const { loadEndpoint } = await freshStore();
    const ep = await deployEndpoint();
    expect(ep.endpoint_id).toMatch(/^ep_[a-z0-9]{6,32}$/);
    expect(ep.status).toBe('live');
    expect(ep.url).toBe(`https://hx.memrails.dev/${ep.endpoint_id}`);
    expect(ep.compressor).toBe('compress-v1');
    expect(ep.integrations).toHaveLength(9);
    expect(ep.integrations.filter((i) => i.prewired)).toHaveLength(3);
    expect(ep.deploy_log.map((s) => s.name)).toEqual([
      'provision_openclaw',
      'index_knowledge',
      'apply_config',
      'bind_compress',
      'wire_integrations',
    ]);
    expect(ep.deploy_log.every((s) => s.status === 'ok')).toBe(true);
    expect(ep.corpus_keys).toBeGreaterThan(0);
    expect(loadEndpoint(ep.endpoint_id)).not.toBeNull();
  });

  it('logs HARNESS_DEPLOYED with the deploy_log in metadata', async () => {
    const { deployEndpoint } = await freshDeploy();
    const { readAllEvents } = await freshLedger();
    const ep = await deployEndpoint();
    const event = readAllEvents().find(
      (e) => e.event_type === 'HARNESS_DEPLOYED' && e.endpoint_id === ep.endpoint_id,
    );
    expect(event).toBeDefined();
    expect(event?.metadata.url).toBe(ep.url);
    expect(event?.metadata.corpus_keys).toBe(ep.corpus_keys);
    expect(Array.isArray(event?.metadata.deploy_log)).toBe(true);
    expect((event?.metadata.integrations as string[]).length).toBe(9);
  });

  it('reflects the real corpus claim count in corpus_keys', async () => {
    const { deployEndpoint } = await freshDeploy();
    const corpus = (await import('@/lib/memory/corpus')).loadCorpus();
    const ep = await deployEndpoint();
    expect(ep.corpus_keys).toBe(corpus.length);
    const indexStep = ep.deploy_log.find((s) => s.name === 'index_knowledge');
    expect(indexStep?.note).toContain(`${corpus.length} claims`);
  });

  it('rejects a corpus_path that escapes the working directory', async () => {
    const { deployEndpoint, InvalidCorpusPath } = await freshDeploy();
    await expect(deployEndpoint({ corpus_path: '../etc' })).rejects.toBeInstanceOf(
      InvalidCorpusPath,
    );
  });
});

describe('closeEndpoint', () => {
  it('flips status to closed', async () => {
    const { deployEndpoint, closeEndpoint } = await freshDeploy();
    const ep = await deployEndpoint();
    const closed = closeEndpoint(ep.endpoint_id);
    expect(closed.status).toBe('closed');
  });

  it('is idempotent on a closed endpoint', async () => {
    const { deployEndpoint, closeEndpoint } = await freshDeploy();
    const ep = await deployEndpoint();
    closeEndpoint(ep.endpoint_id);
    const second = closeEndpoint(ep.endpoint_id);
    expect(second.status).toBe('closed');
  });

  it('throws EndpointNotFound on unknown id', async () => {
    const { closeEndpoint, EndpointNotFound } = await freshDeploy();
    expect(() => closeEndpoint('ep_missing')).toThrow(EndpointNotFound);
  });
});

describe('listEndpoints', () => {
  it('returns endpoints in newest-first order', async () => {
    const { deployEndpoint } = await freshDeploy();
    const { listEndpoints } = await freshStore();
    const a = await deployEndpoint();
    await new Promise((r) => setTimeout(r, 5));
    const b = await deployEndpoint();
    const ids = listEndpoints().map((e) => e.endpoint_id);
    expect(ids[0]).toBe(b.endpoint_id);
    expect(ids).toContain(a.endpoint_id);
  });

  it('returns null from loadEndpoint for malformed ids (path traversal guard)', async () => {
    const { loadEndpoint } = await freshStore();
    expect(loadEndpoint('../etc/passwd')).toBeNull();
    expect(loadEndpoint('ep_invalid id')).toBeNull();
  });
});
