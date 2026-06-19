import type { CompiledEntry, CompiledSection, CompiledView, CompileInput } from '@/types/compiled';
import { DEFAULT_SCOPE } from './registry';
import { selectScoped, toTimelineEntry } from './temporal';
import { tokenize, relevanceScore } from './ranking';

function titleFromPath(path: string): string {
  const last = path.split('/').filter(Boolean).pop() ?? 'root';
  return last
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/**
 * Compile a made-to-order index for a prompt over a time slice.
 *
 * 1. Take the completeness slice (all in-scope memory in the window / as-of).
 * 2. Build a fresh index over ONLY that slice, organized by topic.
 * 3. Score every record + section against the prompt and order by relevance.
 * 4. Return everything — completeness preserved; relevance is for ordering, not
 *    filtering. Deterministic lexical projection, no synthesis.
 */
export function compileView(input: CompileInput): CompiledView {
  const owner_id = input.owner_id ?? DEFAULT_SCOPE.owner_id;
  const { records, mode, asOf } = selectScoped(input);
  const taskTokens = new Set(tokenize(input.task_context));

  const entries: CompiledEntry[] = records.map((r) => ({
    ...toTimelineEntry(r, asOf?.get(r.memory_id)),
    relevance: Number(relevanceScore(r, taskTokens).toFixed(4)),
  }));

  // Group into a made-to-order index over the slice (by topic).
  const byPath = new Map<string, CompiledEntry[]>();
  for (const e of entries) {
    const arr = byPath.get(e.index_path) ?? [];
    arr.push(e);
    byPath.set(e.index_path, arr);
  }

  const sections: CompiledSection[] = [...byPath.entries()].map(([path, items]) => ({
    path,
    title: titleFromPath(path),
    relevance: items.reduce((max, e) => Math.max(max, e.relevance), 0),
    // Within a section: most relevant first, then system time.
    entries: items.sort(
      (a, b) => b.relevance - a.relevance || Date.parse(a.created_at) - Date.parse(b.created_at),
    ),
  }));

  // Sections ordered by prompt relevance; ties fall back to path for stability.
  sections.sort((a, b) => b.relevance - a.relevance || a.path.localeCompare(b.path));

  return {
    scope: { owner_id, project_id: input.project_id },
    contract: 'completeness',
    query: input.task_context,
    mode,
    from: input.from,
    to: input.to,
    as_of: input.as_of,
    total: entries.length,
    total_relevant: entries.filter((e) => e.relevance > 0).length,
    sections,
    compiled_at: new Date().toISOString(),
    trace: {
      records_in_window: records.length,
      sections: sections.length,
      top_section: sections[0]?.path,
    },
  };
}
