import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import matter from 'gray-matter';
import type { EvidenceClaim } from '@/types/evidence';
import { dataRoot } from '@/lib/runtime';

const ACTOR_ID_PATTERN = /^[a-z0-9_:.-]{1,128}$/i;
const GLOBAL_KEY = '_global';

function globalKnowledgeDir(): string {
  return resolve(process.cwd(), 'knowledge');
}

function actorKnowledgeDir(actor_id: string): string {
  return resolve(dataRoot(), 'corpora', actor_id, 'knowledge');
}

function resolveCorpusDir(actor_id?: string): { dir: string; key: string } {
  if (actor_id && ACTOR_ID_PATTERN.test(actor_id)) {
    const dir = actorKnowledgeDir(actor_id);
    if (existsSync(dir)) return { dir, key: actor_id };
  }
  return { dir: globalKnowledgeDir(), key: GLOBAL_KEY };
}

function walkMarkdown(dir: string): string[] {
  const out: string[] = [];
  const entries = readdirSync(dir);
  for (const entry of entries) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...walkMarkdown(full));
    } else if (entry.endsWith('.md')) {
      out.push(full);
    }
  }
  return out;
}

export function knowledgeDir(actor_id?: string): string {
  return resolveCorpusDir(actor_id).dir;
}

export function listKnowledgeFiles(actor_id?: string): string[] {
  const { dir } = resolveCorpusDir(actor_id);
  if (!existsSync(dir)) return [];
  return walkMarkdown(dir).map((p) =>
    relative(process.cwd(), p).replace(/\\/g, '/'),
  );
}

export function findClaim(id: string, actor_id?: string): EvidenceClaim | null {
  const hit = loadCorpus({ actor_id }).find((entry) => entry.claim.id === id);
  return hit ? hit.claim : null;
}

export type CorpusEntry = {
  claim: EvidenceClaim;
  body: string;
};

const caches: Map<string, CorpusEntry[]> = new Map();

export type LoadCorpusOpts = { actor_id?: string; force?: boolean };

export function loadCorpus(opts: LoadCorpusOpts = {}): CorpusEntry[] {
  const { dir, key } = resolveCorpusDir(opts.actor_id);
  if (!opts.force) {
    const hit = caches.get(key);
    if (hit) return hit;
  }
  if (!existsSync(dir)) {
    caches.set(key, []);
    return [];
  }

  const files = walkMarkdown(dir);
  const entries: CorpusEntry[] = [];

  for (const path of files) {
    const raw = readFileSync(path, 'utf8');
    const parsed = matter(raw);
    const data = parsed.data as Record<string, unknown>;
    const rel = relative(process.cwd(), path).replace(/\\/g, '/');

    const id =
      typeof data.id === 'string'
        ? data.id
        : `clm_${rel.replace(/[^a-z0-9]+/gi, '_').toLowerCase()}`;

    const claim: EvidenceClaim = {
      id,
      source_file: rel,
      claim: typeof data.claim === 'string' ? data.claim : extractFirstParagraph(parsed.content),
      confidence: typeof data.confidence === 'number' ? data.confidence : 0.8,
      tags: Array.isArray(data.tags) ? (data.tags as string[]) : [],
      aliases: Array.isArray(data.aliases) ? (data.aliases as string[]) : [],
      contradictions: Array.isArray(data.contradictions)
        ? (data.contradictions as string[])
        : undefined,
      evidence_urls: Array.isArray(data.evidence_urls)
        ? (data.evidence_urls as string[])
        : undefined,
      created_at:
        typeof data.created_at === 'string'
          ? data.created_at
          : new Date(0).toISOString().slice(0, 10),
      updated_at:
        typeof data.updated_at === 'string'
          ? data.updated_at
          : new Date(0).toISOString().slice(0, 10),
    };

    entries.push({ claim, body: parsed.content });
  }

  caches.set(key, entries);
  return entries;
}

function extractFirstParagraph(content: string): string {
  const stripped = content
    .split('\n')
    .filter((line) => !line.startsWith('#') && line.trim().length > 0)
    .join(' ')
    .trim();
  return stripped.slice(0, 400);
}
