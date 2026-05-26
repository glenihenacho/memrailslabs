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
  workdir = mkdtempSync(join(tmpdir(), 'memrails-endpoints-api-'));
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

async function freshRoutes() {
  const deploy = (await import('@/lib/endpoints/deploy')) as typeof import('@/lib/endpoints/deploy');
  const list = await import('@/app/api/endpoints/route');
  const detail = await import('@/app/api/endpoints/[endpoint_id]/route');
  const close = await import('@/app/api/endpoints/[endpoint_id]/close/route');
  return { deploy, list, detail, close };
}

function jsonPost(body: unknown): Request {
  const str = JSON.stringify(body);
  return new Request('http://localhost/x', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'content-length': String(Buffer.byteLength(str)),
    },
    body: str,
  });
}

function emptyPost(): Request {
  return new Request('http://localhost/x', { method: 'POST' });
}

describe('GET /api/endpoints', () => {
  it('returns empty list initially', async () => {
    const { list } = await freshRoutes();
    const res = await list.GET();
    expect(res.status).toBe(200);
    const body = (await res.json()) as { endpoints: unknown[] };
    expect(body.endpoints).toEqual([]);
  });

  it('returns deployed endpoints', async () => {
    const { list, deploy } = await freshRoutes();
    await deploy.deployEndpoint();
    const res = await list.GET();
    const body = (await res.json()) as { endpoints: Array<{ status: string }> };
    expect(body.endpoints).toHaveLength(1);
    expect(body.endpoints[0].status).toBe('live');
  });
});

describe('POST /api/endpoints', () => {
  it('deploys with defaults and returns 201', async () => {
    const { list } = await freshRoutes();
    const res = await list.POST(emptyPost());
    expect(res.status).toBe(201);
    const body = (await res.json()) as {
      endpoint_id: string;
      status: string;
      corpus_keys: number;
    };
    expect(body.endpoint_id).toMatch(/^ep_[a-z0-9]{6,32}$/);
    expect(body.status).toBe('live');
    expect(body.corpus_keys).toBeGreaterThan(0);
  });

  it('accepts an explicit corpus_path', async () => {
    const { list } = await freshRoutes();
    const res = await list.POST(jsonPost({ corpus_path: 'knowledge/' }));
    expect(res.status).toBe(201);
  });

  it('422s on a corpus_path outside the working directory', async () => {
    const { list } = await freshRoutes();
    const res = await list.POST(jsonPost({ corpus_path: '../etc' }));
    expect(res.status).toBe(422);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe('invalid_corpus_path');
  });

  it('400s on malformed JSON', async () => {
    const { list } = await freshRoutes();
    const req = new Request('http://localhost/x', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{not json',
    });
    const res = await list.POST(req);
    expect(res.status).toBe(400);
  });

  it('413s on oversized body', async () => {
    const { list } = await freshRoutes();
    const req = new Request('http://localhost/x', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'content-length': String(100 * 1024),
      },
      body: '{}',
    });
    const res = await list.POST(req);
    expect(res.status).toBe(413);
  });
});

describe('GET /api/endpoints/[endpoint_id]', () => {
  it('404s on unknown id', async () => {
    const { detail } = await freshRoutes();
    const res = await detail.GET(new Request('http://x/'), {
      params: { endpoint_id: 'ep_doesnotexist' },
    });
    expect(res.status).toBe(404);
  });

  it('returns the full endpoint with deploy_log', async () => {
    const { detail, deploy } = await freshRoutes();
    const ep = await deploy.deployEndpoint();
    const res = await detail.GET(new Request('http://x/'), {
      params: { endpoint_id: ep.endpoint_id },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      endpoint_id: string;
      deploy_log: unknown[];
      integrations: unknown[];
    };
    expect(body.endpoint_id).toBe(ep.endpoint_id);
    expect(body.deploy_log).toHaveLength(5);
    expect(body.integrations).toHaveLength(9);
  });
});

describe('POST /api/endpoints/[endpoint_id]/close', () => {
  it('closes the endpoint', async () => {
    const { close, deploy } = await freshRoutes();
    const ep = await deploy.deployEndpoint();
    const res = await close.POST(emptyPost(), {
      params: { endpoint_id: ep.endpoint_id },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string };
    expect(body.status).toBe('closed');
  });

  it('404s on unknown id', async () => {
    const { close } = await freshRoutes();
    const res = await close.POST(emptyPost(), {
      params: { endpoint_id: 'ep_missing' },
    });
    expect(res.status).toBe(404);
  });
});
