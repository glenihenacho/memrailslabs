/**
 * Postgres authority — conversion phase C2 public surface.
 *
 * `ensureAuthorityReady()` before the first read, `flushAuthority()` before
 * a process (or serverless response) that just wrote returns. Both are
 * no-ops / instant in file mode, so entrypoints call them unconditionally.
 */
export { authorityMode, type AuthorityMode } from './mode';
export { ensureAuthorityReady, resetAuthorityForTests, dropSnapshotForTests } from './snapshot';
export { flushAuthority } from './persist';
export { getDb, closeDb } from './client';
