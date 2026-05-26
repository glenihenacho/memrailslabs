import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let workdir: string;
const originalCwd = process.cwd();

beforeEach(() => {
  workdir = mkdtempSync(join(tmpdir(), 'memrails-sessions-api-'));
  mkdirSync(join(workdir, 'data', 'logs'), { recursive: true });
  mkdirSync(join(workdir, 'data', 'sessions'), { recursive: true });
  process.chdir(workdir);
  vi.resetModules();
});

afterEach(() => {
  process.chdir(originalCwd);
  if (existsSync(workdir)) rmSync(workdir, { recursive: true, force: true });
});

async function freshRoutes() {
  const sessions = (await import('@/lib/payments/sessions')) as typeof import('@/lib/payments/sessions');
  const list = await import('@/app/api/sessions/route');
  const detail = await import('@/app/api/sessions/[session_id]/route');
  const close = await import('@/app/api/sessions/[session_id]/close/route');
  return { sessions, list, detail, close };
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

describe('GET /api/sessions', () => {
  it('returns empty list initially', async () => {
    const { list } = await freshRoutes();
    const res = await list.GET();
    expect(res.status).toBe(200);
    const body = (await res.json()) as { sessions: unknown[] };
    expect(body.sessions).toEqual([]);
  });

  it('returns sessions with remaining_cents computed', async () => {
    const { list, sessions } = await freshRoutes();
    sessions.authorizeSession({ budget_cents: 200, rail: 'stripe_card' });
    const res = await list.GET();
    const body = (await res.json()) as {
      sessions: Array<{ session_id: string; remaining_cents: number; rail: string }>;
    };
    expect(body.sessions).toHaveLength(1);
    expect(body.sessions[0].remaining_cents).toBe(200);
    expect(body.sessions[0].rail).toBe('stripe_card');
  });
});

describe('POST /api/sessions', () => {
  it('authorizes a session and returns 201 with session_id', async () => {
    const { list } = await freshRoutes();
    const res = await list.POST(jsonPost({ budget_cents: 500, rail: 'lightning' }));
    expect(res.status).toBe(201);
    const body = (await res.json()) as {
      session_id: string;
      status: string;
      remaining_cents: number;
    };
    expect(body.session_id).toMatch(/^sess_[a-z0-9]{6,32}$/);
    expect(body.status).toBe('authorized');
    expect(body.remaining_cents).toBe(500);
  });

  it('422s on invalid rail', async () => {
    const { list } = await freshRoutes();
    const res = await list.POST(jsonPost({ budget_cents: 100, rail: 'paypal' }));
    expect(res.status).toBe(422);
  });

  it('422s on missing budget', async () => {
    const { list } = await freshRoutes();
    const res = await list.POST(jsonPost({ rail: 'stripe_card' }));
    expect(res.status).toBe(422);
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

describe('GET /api/sessions/[session_id]', () => {
  it('404s on unknown id', async () => {
    const { detail } = await freshRoutes();
    const res = await detail.GET(new Request('http://x/'), {
      params: { session_id: 'sess_doesnotexist' },
    });
    expect(res.status).toBe(404);
  });

  it('returns the session with remaining_cents', async () => {
    const { detail, sessions } = await freshRoutes();
    const s = sessions.authorizeSession({ budget_cents: 75, rail: 'visa' });
    const res = await detail.GET(new Request('http://x/'), {
      params: { session_id: s.session_id },
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { session_id: string; remaining_cents: number };
    expect(body.session_id).toBe(s.session_id);
    expect(body.remaining_cents).toBe(75);
  });
});

describe('POST /api/sessions/[session_id]/close', () => {
  it('closes the session', async () => {
    const { close, sessions } = await freshRoutes();
    const s = sessions.authorizeSession({ budget_cents: 10, rail: 'custom' });
    const res = await close.POST(emptyPost(), { params: { session_id: s.session_id } });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string };
    expect(body.status).toBe('closed');
  });

  it('404s on unknown id', async () => {
    const { close } = await freshRoutes();
    const res = await close.POST(emptyPost(), {
      params: { session_id: 'sess_missing' },
    });
    expect(res.status).toBe(404);
  });
});
