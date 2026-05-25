import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import matter from 'gray-matter';
import type { EvidenceClaim } from '@/types/evidence';

const KNOWLEDGE_DIR = resolve(process.cwd(), 'knowledge');

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

export type CorpusEntry = {
  claim: EvidenceClaim;
  body: string;
};

let cache: CorpusEntry[] | null = null;

export function loadCorpus(opts: { force?: boolean } = {}): CorpusEntry[] {
  if (cache && !opts.force) return cache;

  const files = walkMarkdown(KNOWLEDGE_DIR);
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

  cache = entries;
  return cache;
}

function extractFirstParagraph(content: string): string {
  const stripped = content
    .split('\n')
    .filter((line) => !line.startsWith('#') && line.trim().length > 0)
    .join(' ')
    .trim();
  return stripped.slice(0, 400);
}
