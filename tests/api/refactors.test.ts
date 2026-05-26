import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let workdir: string;
const originalCwd = process.cwd();

beforeEach(() => {
  workdir = mkdtempSync(join(tmpdir(), 'memrails-refactor-api-'));
  mkdirSync(join(workdir, 'knowledge', 'claims'), { recursive: true });
  mkdirSync(join(workdir, 'data', 'logs'), { recursive: true });
  mkdirSync(join(workdir, 'data', 'refactors'), { recursive: true });
  writeFileSync(
    join(workdir, 'knowledge', 'claims', 'seed.md'),
    `---\nid: clm_seed\ntags: []\nclaim: seed\n---\n# seed\nseed body\n`,
    'utf8',
  );
  process.chdir(workdir);
  vi.resetModules();
});

afterEach(() => {
  process.chdir(originalCwd);
  if (existsSync(workdir)) rmSync(workdir, { recursive: true, force: true });
});

async function freshRoutes() {
  const proposals = (await import(
    '@/lib/refactor/proposals'
  )) as typeof import('@/lib/refactor/proposals');
  const list = await import('@/app/api/refactors/route');
  const detail = await import('@/app/api/refactors/[refactor_id]/route');
  const accept = await import('@/app/api/refactors/[refactor_id]/accept/route');
  const reject = await import('@/app/api/refactors/[refactor_id]/reject/route');
  return { proposals, list, detail, accept, reject };
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

describe('GET /api/refactors', () => {
  it('returns empty list initially', async () => {
    const { list } = await freshRoutes();
    const res = await list.GET();
    expect(res.status).toBe(200);
    const body = (await res.json()) as { refactors: unknown[] };
    expect(body.refactors).toEqual([]);
  });

  it('returns summaries after a proposal is created', async () => {
    const { list, proposals } = await freshRoutes();
    proposals.proposeRefactor({ claim: 'listed claim', evidence: ['e'] });
    const res = await list.GET();
    const body = (await res.json()) as {
      refactors: Array<{ refactor_id: string; status: string }>;
    };
    expect(body.refactors).toHaveLength(1);
    expect(body.refactors[0].status).toBe('proposed');
  });
});

describe('GET /api/refactors/[refactor_id]', () => {
  it('404s on unknown id', async () => {
    const { detail } = await freshRoutes();
    const res = await detail.GET(new Request('http://x/'), {
      params: { refactor_id: 'ref_doesnotexist' },
    });
    expect(res.status).toBe(404);
  });

  it('returns the full proposal when found', async () => {
    const { detail, proposals } = await freshRoutes();
    const created = proposals.proposeRefactor({
      claim: 'detail claim',
      evidence: ['e'],
    });
    const res = await detail.GET(new Request('http://x/'), {
      params: { refactor_id: created.refactor_id },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { refactor_id: string; proposed_diff: string };
    expect(body.refactor_id).toBe(created.refactor_id);
    expect(body.proposed_diff).toContain('--- /dev/null');
  });
});

describe('POST /api/refactors/[refactor_id]/accept', () => {
  it('accepts a proposal and writes the markdown file', async () => {
    const { accept, proposals } = await freshRoutes();
    const created = proposals.proposeRefactor({
      claim: 'accept via api',
      evidence: ['e'],
    });
    const res = await accept.POST(emptyPost(), {
      params: { refactor_id: created.refactor_id },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; applied_path: string };
    expect(body.status).toBe('accepted');
    expect(existsSync(join(workdir, body.applied_path))).toBe(true);
  });

  it('409s when the proposal is already rejected', async () => {
    const { accept, proposals } = await freshRoutes();
    const created = proposals.proposeRefactor({
      claim: 'conflict',
      evidence: ['e'],
    });
    proposals.rejectRefactor(created.refactor_id);
    const res = await accept.POST(emptyPost(), {
      params: { refactor_id: created.refactor_id },
    });
    expect(res.status).toBe(409);
  });

  it('404s on unknown id', async () => {
    const { accept } = await freshRoutes();
    const res = await accept.POST(emptyPost(), {
      params: { refactor_id: 'ref_missing' },
    });
    expect(res.status).toBe(404);
  });
});

describe('POST /api/refactors/[refactor_id]/reject', () => {
  it('rejects with a reason from the request body', async () => {
    const { reject, proposals } = await freshRoutes();
    const created = proposals.proposeRefactor({
      claim: 'reject via api',
      evidence: ['e'],
    });
    const res = await reject.POST(jsonPost({ reason: 'too vague' }), {
      params: { refactor_id: created.refactor_id },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; reason: string };
    expect(body.status).toBe('rejected');
    expect(body.reason).toBe('too vague');
  });

  it('409s when the proposal is already accepted', async () => {
    const { reject, proposals } = await freshRoutes();
    const created = proposals.proposeRefactor({
      claim: 'cant reject after accept',
      evidence: ['e'],
    });
    proposals.acceptRefactor(created.refactor_id);
    const res = await reject.POST(emptyPost(), {
      params: { refactor_id: created.refactor_id },
    });
    expect(res.status).toBe(409);
  });
});
