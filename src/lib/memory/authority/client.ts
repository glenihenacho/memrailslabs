import { resolve } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { dataPath } from '@/lib/paths';
import { SCHEMA } from './schema';

/**
 * Embedded Postgres client (PGlite). One instance per process; schema is
 * applied idempotently on first open. Location:
 *
 *   MEMRAILS_PG_DIR=:memory:   → in-memory (tests)
 *   MEMRAILS_PG_DIR=<dir>      → file-persisted at <dir>
 *   unset                      → file-persisted at <data>/authority
 *
 * A hosted deploy swaps this module for a pg-wire client against the same
 * schema — nothing above the persist/hydrate functions changes.
 */

let db: PGlite | null = null;
let opening: Promise<PGlite> | null = null;

function location(): string {
  const dir = process.env.MEMRAILS_PG_DIR;
  if (dir === ':memory:' || dir === 'memory://') return 'memory://';
  if (dir) return resolve(dir);
  return dataPath('authority');
}

export async function getDb(): Promise<PGlite> {
  if (db) return db;
  if (!opening) {
    opening = (async () => {
      const instance = new PGlite(location());
      await instance.exec(SCHEMA);
      db = instance;
      return instance;
    })();
  }
  return opening;
}

export async function closeDb(): Promise<void> {
  if (db) {
    await db.close();
    db = null;
    opening = null;
  }
}
