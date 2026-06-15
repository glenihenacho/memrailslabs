import { NextResponse } from 'next/server';
import { loadRegistry } from '@/lib/memory';
import { artifactRail } from '@/lib/rails/artifact';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Memory export. No lock-in (CLAUDE.md Rule 7): owners can pull their full
 * governed memory as JSON, JSONL, or Markdown.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const format = url.searchParams.get('format') ?? 'json';
  const project = url.searchParams.get('project_id');
  let records = loadRegistry({ force: true });
  if (project) records = records.filter((r) => r.scope.project_id === project);

  if (format === 'jsonl') {
    const body = records.map((r) => JSON.stringify(r)).join('\n');
    return new Response(body, { headers: { 'content-type': 'application/x-ndjson' } });
  }

  if (format === 'markdown' || format === 'md') {
    const body = records
      .map(
        (r) =>
          `## ${r.memory_id}\n\n- **type:** ${r.memory_type}\n- **status:** ${r.status}\n- **confidence:** ${r.confidence}\n- **scope:** ${r.scope.owner_id} / ${r.scope.project_id} / ${r.scope.agent_id ?? '*'}\n- **path:** ${r.index_path}\n\n${r.content}\n`,
      )
      .join('\n---\n\n');
    return new Response(`# MemRails memory export\n\n${body}`, {
      headers: { 'content-type': 'text/markdown' },
    });
  }

  // Persist a snapshot to the Artifact Rail and hand back its ref (no lock-in:
  // the export is both returned inline and preserved as a pullable artifact).
  const owner = project ? records[0]?.scope.owner_id ?? 'user_memrails' : 'user_memrails';
  const ref = artifactRail.put(owner, `export-${Date.now()}.json`, JSON.stringify({ records }));
  return NextResponse.json({ count: records.length, artifact_ref: ref, records });
}
