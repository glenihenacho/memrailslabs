import { rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, it, expect } from 'vitest';
import type { MemoryRecord, MemoryVersion } from '@/types/governed';
import { statusAsOf, compileTimeline } from '@/lib/memory/temporal';
import { write } from '@/lib/memory/write';
import { forget } from '@/lib/memory/lifecycle';
import { enroll, invalidateAccounts } from '@/lib/accounts/store';
import { invalidateRegistry } from '@/lib/memory/registry';

function reset() {
  rmSync(resolve(__dirname, '../../.tmp-test-data'), { recursive: true, force: true });
  invalidateRegistry();
  invalidateAccounts();
}

function record(created_at: string): MemoryRecord {
  return {
    memory_id: 'mem_x',
    scope: { owner_id: 'o', project_id: 'p', agent_id: null },
    memory_type: 'note',
    status: 'active',
    confidence: 0.9,
    sensitivity: 'normal',
    content: 'c',
    summary: 's',
    tags: [],
    aliases: [],
    source_file: 'f',
    source_refs: [],
    contradictions: [],
    index_path: '/project/p/x',
    current_version: 1,
    superseded_by: null,
    created_at,
    updated_at: created_at,
    expires_at: null,
  };
}

describe('statusAsOf — system-time reconstruction', () => {
  const versions: MemoryVersion[] = [
    { version_id: 'v1', memory_id: 'mem_x', version_number: 1, change_type: 'SUPERSEDE', changed_by: 't', diff_summary: '', created_at: '2026-02-01T00:00:00.000Z' },
  ];
  const rec = record('2026-01-01T00:00:00.000Z');

  it('is nonexistent before creation', () => {
    expect(statusAsOf(rec, versions, Date.parse('2025-12-01T00:00:00.000Z'))).toBe('nonexistent');
  });
  it('is active between creation and the transition', () => {
    expect(statusAsOf(rec, versions, Date.parse('2026-01-15T00:00:00.000Z'))).toBe('active');
  });
  it('is superseded after the transition', () => {
    expect(statusAsOf(rec, versions, Date.parse('2026-03-01T00:00:00.000Z'))).toBe('superseded');
  });
});

describe('compileTimeline — completeness window over the curated corpus', () => {
  beforeEach(reset);

  it('returns every record created in the window and excludes others', () => {
    const tl = compileTimeline({
      from: '2026-05-01T00:00:00.000Z',
      to: '2026-05-31T23:59:59.999Z',
    });
    expect(tl.contract).toBe('completeness');
    expect(tl.mode).toBe('window');
    expect(tl.total).toBeGreaterThan(0);
    // Completeness: every returned entry falls inside the window...
    for (const e of tl.chronological) {
      const c = Date.parse(e.created_at);
      expect(c).toBeGreaterThanOrEqual(Date.parse('2026-05-01T00:00:00.000Z'));
      expect(c).toBeLessThanOrEqual(Date.parse('2026-05-31T23:59:59.999Z'));
    }
    const ids = tl.chronological.map((e) => e.memory_id);
    expect(ids).toContain('clm_packet_contract'); // created 2026-05-25
    expect(ids).not.toContain('clm_billing_model_doc'); // created 2026-06-14
  });
});

describe('compileTimeline — as_of and forget redaction', () => {
  beforeEach(reset);

  it('includes a record in the active set only after it exists', () => {
    const acct = enroll('temporal@example.com');
    write({ content: 'A decision made now.', owner_id: acct.owner_id, memory_type: 'decision' });

    const future = compileTimeline({ owner_id: acct.owner_id, as_of: new Date(Date.now() + 1000).toISOString() });
    expect(future.mode).toBe('as_of');
    expect(future.total).toBe(1);
    expect(future.chronological[0].status_as_of).toBe('active');

    const past = compileTimeline({ owner_id: acct.owner_id, as_of: '2020-01-01T00:00:00.000Z' });
    expect(past.total).toBe(0); // did not exist yet
  });

  it('keeps forgotten records in the window but redacts the body', () => {
    const acct = enroll('redact@example.com');
    const { memory_id } = write({ content: 'Sensitive scratch note.', owner_id: acct.owner_id });
    forget(memory_id, { reason: 'cleanup' });

    const tl = compileTimeline({ owner_id: acct.owner_id }); // open-ended window = all
    const entry = tl.chronological.find((e) => e.memory_id === memory_id);
    expect(entry).toBeDefined();
    expect(entry?.status).toBe('tombstoned');
    expect(entry?.summary).toBe('[forgotten]');
  });
});
