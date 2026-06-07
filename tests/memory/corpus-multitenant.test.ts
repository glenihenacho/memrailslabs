import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadCorpus, knowledgeDir, listKnowledgeFiles } from '@/lib/memory/corpus';

let dataDir: string;
const originalDataDir = process.env.DATA_DIR;

beforeEach(() => {
  dataDir = mkdtempSync(join(tmpdir(), 'memrails-corpus-'));
  process.env.DATA_DIR = dataDir;
});

afterEach(() => {
  if (originalDataDir === undefined) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = originalDataDir;
  if (existsSync(dataDir)) rmSync(dataDir, { recursive: true, force: true });
  // Phase 2 introduces a per-actor cache. Force a reload by importing fresh.
  loadCorpus({ force: true });
});

function seedActorCorpus(actor_id: string, files: Record<string, string>) {
  const dir = join(dataDir, 'corpora', actor_id, 'knowledge', 'claims');
  mkdirSync(dir, { recursive: true });
  for (const [name, body] of Object.entries(files)) {
    writeFileSync(join(dir, name), body, 'utf8');
  }
}

describe('loadCorpus({ actor_id })', () => {
  it('falls back to the global knowledge/ when no actor supplied', () => {
    const corpus = loadCorpus({ force: true });
    expect(corpus.length).toBeGreaterThan(0);
    // The default repo corpus has packet-contract claim
    expect(corpus.some((e) => e.claim.id.includes('packet'))).toBe(true);
  });

  it('returns per-actor entries when corpora/<actor>/knowledge/ exists', () => {
    seedActorCorpus('actor_a', {
      'one.md': `---\nid: clm_actor_a_one\ntags: [a]\nclaim: actor a unique claim\n---\nactor a body\n`,
    });
    const corpus = loadCorpus({ actor_id: 'actor_a', force: true });
    const ids = corpus.map((e) => e.claim.id);
    expect(ids).toContain('clm_actor_a_one');
  });

  it('does not leak between actors', () => {
    seedActorCorpus('actor_a', {
      'a.md': `---\nid: clm_only_a\nclaim: a only\n---\na\n`,
    });
    seedActorCorpus('actor_b', {
      'b.md': `---\nid: clm_only_b\nclaim: b only\n---\nb\n`,
    });
    const a = loadCorpus({ actor_id: 'actor_a', force: true }).map((e) => e.claim.id);
    const b = loadCorpus({ actor_id: 'actor_b', force: true }).map((e) => e.claim.id);
    expect(a).toContain('clm_only_a');
    expect(a).not.toContain('clm_only_b');
    expect(b).toContain('clm_only_b');
    expect(b).not.toContain('clm_only_a');
  });

  it('falls back to global when the per-actor dir does not exist', () => {
    // no seed for actor_c
    const corpus = loadCorpus({ actor_id: 'actor_c', force: true });
    // Should match global corpus length
    const global = loadCorpus({ force: true });
    expect(corpus.length).toBe(global.length);
  });

  it('caches per-actor (second call without force returns same array)', () => {
    seedActorCorpus('actor_d', {
      'a.md': `---\nid: clm_d\nclaim: d\n---\nd\n`,
    });
    const first = loadCorpus({ actor_id: 'actor_d', force: true });
    const second = loadCorpus({ actor_id: 'actor_d' });
    expect(second).toBe(first);
  });

  it('rejects path-traversal actor_ids (falls back to global)', () => {
    seedActorCorpus('actor_a', {
      'a.md': `---\nid: clm_a\nclaim: a\n---\na\n`,
    });
    const corpus = loadCorpus({ actor_id: '../actor_a', force: true });
    const global = loadCorpus({ force: true });
    expect(corpus.length).toBe(global.length);
  });
});

describe('knowledgeDir() + listKnowledgeFiles() with actor_id', () => {
  it('returns the per-actor dir when actor corpus exists', () => {
    seedActorCorpus('actor_a', {
      'a.md': `---\nid: clm_x\nclaim: x\n---\nx\n`,
    });
    const dir = knowledgeDir('actor_a');
    expect(dir).toContain('corpora/actor_a/knowledge');
  });

  it('lists only the per-actor files', () => {
    seedActorCorpus('actor_a', {
      'a.md': `---\nid: clm_x\nclaim: x\n---\nx\n`,
      'b.md': `---\nid: clm_y\nclaim: y\n---\ny\n`,
    });
    const files = listKnowledgeFiles('actor_a');
    expect(files).toHaveLength(2);
    expect(files.every((f) => f.includes('corpora/actor_a'))).toBe(true);
  });
});
