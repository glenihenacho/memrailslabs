/**
 * Contract v0.1 §7 conformance — the memrails.md projection.
 * Interface-level: seed through memory.write / lifecycle, project, assert on
 * the markdown and stats only.
 */
import { rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, it, expect } from 'vitest';
import { write } from '@/lib/memory/write';
import { supersede, forget } from '@/lib/memory/lifecycle';
import { invalidateRegistry } from '@/lib/memory/registry';
import { projectMarkdown } from '@/lib/memory/project-md';

const PROJECT = 'project_projection_conf';

function resetData() {
  rmSync(resolve(__dirname, '../../.tmp-test-data'), { recursive: true, force: true });
  invalidateRegistry();
}

describe('contract §7 — memrails.md projection', () => {
  beforeEach(resetData);

  it('starts with a DERIVED ARTIFACT header and ends with a trace footer', () => {
    const { markdown, stats } = projectMarkdown({ project_id: PROJECT });
    expect(markdown.startsWith('<!-- DERIVED ARTIFACT')).toBe(true);
    expect(markdown).toContain('retrieval trace — memrails.md projection');
    expect(markdown).toContain('policy_filters_applied:');
    expect(markdown).toContain(`generated_at: ${stats.generated_at}`);
    expect(stats.floor).toBe(0.75);
  });

  it('groups projected records into sections by memory_type', () => {
    write({ content: 'Decision: ship the projection first.', project_id: PROJECT, memory_type: 'decision', confidence: 0.9 });
    write({ content: 'Constraint: the projection is read-only.', project_id: PROJECT, memory_type: 'constraint', confidence: 0.9 });
    const { markdown } = projectMarkdown({ project_id: PROJECT });
    expect(markdown).toContain('## Decisions');
    expect(markdown).toContain('## Constraints');
    expect(markdown.indexOf('## Decisions')).toBeLessThan(markdown.indexOf('## Constraints'));
  });

  it('excludes restricted always, sensitive unless requested, below-floor always', () => {
    const restricted = write({ content: 'Restricted material that must never project.', project_id: PROJECT, sensitivity: 'restricted' });
    const sensitive = write({ content: 'Sensitive material projected only on request.', project_id: PROJECT, sensitivity: 'sensitive', confidence: 0.9 });
    const lowConf = write({ content: 'Speculative low-confidence material.', project_id: PROJECT, confidence: 0.5 });

    const closed = projectMarkdown({ project_id: PROJECT });
    expect(closed.markdown).not.toContain(restricted.memory_id);
    expect(closed.markdown).not.toContain(sensitive.memory_id);
    expect(closed.markdown).not.toContain(lowConf.memory_id);
    expect(closed.stats.omitted.sensitive_excluded).toBe(1);
    expect(closed.stats.omitted.below_floor).toBe(1);
    expect(closed.stats.omitted.restricted_sensitivity).toBe(1);

    const open = projectMarkdown({ project_id: PROJECT, include_sensitive: true });
    expect(open.markdown).toContain(sensitive.memory_id);
    expect(open.markdown).not.toContain(restricted.memory_id); // never
  });

  it('projects only active records — superseded and tombstoned stay out', () => {
    const old = write({ content: 'Old fact due for replacement.', project_id: PROJECT, confidence: 0.9 });
    supersede(old.memory_id, {
      new_memory: { content: 'New fact replacing the old one.', project_id: PROJECT, confidence: 0.95 },
    });
    const gone = write({ content: 'Fact to be forgotten entirely.', project_id: PROJECT, confidence: 0.9 });
    forget(gone.memory_id);

    const { markdown, stats } = projectMarkdown({ project_id: PROJECT });
    expect(markdown).not.toContain(old.memory_id);
    expect(markdown).not.toContain(gone.memory_id);
    expect(stats.omitted.superseded).toBe(1);
    expect(stats.omitted.tombstoned).toBe(1);
  });
});
