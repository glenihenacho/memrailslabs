import { describe, it, expect } from 'vitest';
import { GET } from '@/app/api/health/route';

describe('GET /api/health', () => {
  it('returns 200 with ok=true and runtime metadata', async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      ok: boolean;
      commit: string;
      data_dir: string;
      corpus_keys: number;
    };
    expect(body.ok).toBe(true);
    expect(typeof body.commit).toBe('string');
    expect(typeof body.data_dir).toBe('string');
    expect(typeof body.corpus_keys).toBe('number');
    expect(body.corpus_keys).toBeGreaterThan(0);
  });

  it('sets Access-Control-Allow-Origin', async () => {
    const res = await GET();
    expect(res.headers.get('Access-Control-Allow-Origin')).toBeTruthy();
  });
});
