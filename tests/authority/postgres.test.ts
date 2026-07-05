/**
 * Postgres authority tests (conversion phase C2).
 *
 * Prove that Postgres is the system of record, not a mirror: writes land as
 * rows (registry, versions, sources, contradiction edges), and a process
 * that drops its in-memory snapshot rebuilds the identical governed registry
 * purely from the tables. Only meaningful under `npm run test:pg`
 * (MEMRAILS_AUTHORITY=postgres); skipped in file mode.
 */
import { beforeEach, describe, it, expect } from 'vitest';
import { resetData } from '../conformance/helpers';
import { write } from '@/lib/memory/write';
import { supersede, dispute, forget } from '@/lib/memory/lifecycle';
import { retrieve } from '@/lib/memory/retrieve';
import { loadRegistry, getRecord, invalidateRegistry } from '@/lib/memory/registry';
import { loadOverlay } from '@/lib/memory/governance';
import {
  authorityMode,
  ensureAuthorityReady,
  flushAuthority,
  dropSnapshotForTests,
  getDb,
} from '@/lib/memory/authority';

const PROJECT = 'project_pg_authority';
const pgOnly = authorityMode() === 'postgres' ? describe : describe.skip;

pgOnly('postgres authority — system of record', () => {
  beforeEach(resetData);

  it('persists a written record as registry, source, and contradiction rows', async () => {
    const created = write({
      content: 'Postgres is the authority plane; the snapshot is a read replica.',
      project_id: PROJECT,
      memory_type: 'decision',
      tags: ['authority'],
      confidence: 0.95,
    });
    await flushAuthority();

    const db = await getDb();
    const reg = await db.query<{ origin: string; status: string; record: { content: string } }>(
      'SELECT origin, status, record FROM memory_registry WHERE memory_id = $1',
      [created.memory_id],
    );
    expect(reg.rows).toHaveLength(1);
    expect(reg.rows[0].origin).toBe('written');
    expect(reg.rows[0].status).toBe('active');
    expect(reg.rows[0].record.content).toContain('authority plane');

    const sources = await db.query('SELECT type FROM memory_sources WHERE memory_id = $1', [created.memory_id]);
    expect(sources.rows.length).toBeGreaterThan(0);
  });

  it('persists lifecycle transitions as governance columns and version rows', async () => {
    const old = write({ content: 'Authority fact, original.', project_id: PROJECT, confidence: 0.9 });
    const { replacement } = supersede(old.memory_id, {
      new_memory: { content: 'Authority fact, corrected.', project_id: PROJECT, confidence: 0.95 },
      reason: 'corrected',
    });
    const contested = write({ content: 'Contested authority claim.', project_id: PROJECT, confidence: 0.9 });
    dispute(contested.memory_id, { reason: 'contested by benchmark' });
    await flushAuthority();

    const db = await getDb();
    const sup = await db.query<{ status: string; superseded_by: string }>(
      'SELECT status, superseded_by FROM memory_registry WHERE memory_id = $1',
      [old.memory_id],
    );
    expect(sup.rows[0].status).toBe('superseded');
    expect(sup.rows[0].superseded_by).toBe(replacement);

    const versions = await db.query<{ change_type: string }>(
      'SELECT change_type FROM memory_versions WHERE memory_id = $1 ORDER BY version_number',
      [old.memory_id],
    );
    expect(versions.rows.map((v) => v.change_type)).toContain('SUPERSEDE');

    const disp = await db.query<{ status: string; disputed_reason: string }>(
      'SELECT status, disputed_reason FROM memory_registry WHERE memory_id = $1',
      [contested.memory_id],
    );
    expect(disp.rows[0].status).toBe('disputed');
    expect(disp.rows[0].disputed_reason).toBe('contested by benchmark');
  });

  it('rebuilds the identical governed registry from the tables alone', async () => {
    // Seed a governed store through the public interface.
    write({ content: 'Rebuild check: plain decision.', project_id: PROJECT, memory_type: 'decision', confidence: 0.92, tags: ['rebuild'] });
    const old = write({ content: 'Rebuild check: superseded fact.', project_id: PROJECT, confidence: 0.9 });
    supersede(old.memory_id, {
      new_memory: { content: 'Rebuild check: corrected fact.', project_id: PROJECT, confidence: 0.95 },
    });
    const gone = write({ content: 'Rebuild check: forgotten note.', project_id: PROJECT });
    forget(gone.memory_id, { reason: 'cleanup' });
    await flushAuthority();

    const before = loadRegistry({ force: true })
      .filter((r) => r.scope.project_id === PROJECT)
      .map(({ current_version, updated_at, ...r }) => r) // version counter + timestamp derive from overlay shape
      .sort((a, b) => a.memory_id.localeCompare(b.memory_id));
    const overlayBefore = loadOverlay();
    const bundleBefore = retrieve({ task_context: 'rebuild check fact', project_id: PROJECT });

    // Drop every in-memory trace and re-hydrate purely from Postgres.
    dropSnapshotForTests();
    invalidateRegistry();
    await ensureAuthorityReady();

    const after = loadRegistry({ force: true })
      .filter((r) => r.scope.project_id === PROJECT)
      .map(({ current_version, updated_at, ...r }) => r)
      .sort((a, b) => a.memory_id.localeCompare(b.memory_id));

    expect(after).toEqual(before);
    // Governance survives: supersession pointer, tombstone, version history.
    expect(getRecord(old.memory_id, { force: true })?.status).toBe('superseded');
    expect(loadOverlay()[old.memory_id]?.versions?.length).toBe(
      overlayBefore[old.memory_id]?.versions?.length,
    );
    expect(getRecord(gone.memory_id, { force: true })?.status).toBe('tombstoned');

    const bundleAfter = retrieve({ task_context: 'rebuild check fact', project_id: PROJECT });
    expect(bundleAfter.memories.map((m) => m.memory_id).sort()).toEqual(
      bundleBefore.memories.map((m) => m.memory_id).sort(),
    );
  });
});
