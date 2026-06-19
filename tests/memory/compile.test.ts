import { rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, it, expect } from 'vitest';
import { compileView } from '@/lib/memory/compile';
import { compileTimeline } from '@/lib/memory/temporal';
import { invalidateRegistry } from '@/lib/memory/registry';

function reset() {
  rmSync(resolve(__dirname, '../../.tmp-test-data'), { recursive: true, force: true });
  invalidateRegistry();
}

const WINDOW = { from: '2026-05-01T00:00:00.000Z', to: '2026-05-31T23:59:59.999Z' };

describe('compileView — prompt-compiled index over a time slice', () => {
  beforeEach(reset);

  it('preserves completeness — same record count as the timeline window', () => {
    const view = compileView({ task_context: 'packet contract provenance and evidence', ...WINDOW });
    const timeline = compileTimeline(WINDOW);
    expect(view.total).toBe(timeline.total);
    // Every in-window record is present across the sections (nothing dropped).
    const inSections = view.sections.reduce((n, s) => n + s.entries.length, 0);
    expect(inSections).toBe(view.total);
  });

  it('organizes around the prompt — sections ordered by relevance, top is relevant', () => {
    const view = compileView({ task_context: 'packet contract provenance and evidence', ...WINDOW });
    // Sections are sorted by descending relevance.
    for (let i = 0; i + 1 < view.sections.length; i += 1) {
      expect(view.sections[i].relevance).toBeGreaterThanOrEqual(view.sections[i + 1].relevance);
    }
    expect(view.total_relevant).toBeGreaterThan(0);
    expect(view.sections[0].relevance).toBeGreaterThan(0);
    // The packet-contract memory should surface near the top for this prompt.
    const top = view.sections[0];
    expect(top.entries.some((e) => e.memory_id === 'clm_packet_contract')).toBe(true);
  });

  it('keeps zero-relevance records too (completeness, not a filter)', () => {
    const view = compileView({ task_context: 'packet contract', ...WINDOW });
    // total >= total_relevant; the difference is in-window records that simply
    // don't match the prompt but are still returned.
    expect(view.total).toBeGreaterThanOrEqual(view.total_relevant);
  });
});
