/**
 * Authority backend selection — conversion phase C2.
 *
 * `file`     — the file-canonical MVP: `data/governance.json` overlay +
 *              per-owner `written.jsonl` namespaces. The conforming
 *              lightweight backend for self-hosted/local mode.
 * `postgres` — Postgres is the system of record (embedded PGlite; a hosted
 *              deploy points the same schema at a pg-wire server). Reads are
 *              served from an in-process snapshot hydrated from Postgres;
 *              writes update the snapshot synchronously and persist through
 *              a serial journal.
 * `dual`     — the migration window: the file backend stays authoritative
 *              for reads while every write is also journaled into Postgres,
 *              so `authority:diff` can compare the two before the flip.
 *
 * Mode is read per call (never cached) so migration tooling can switch
 * backends within one process.
 */
export type AuthorityMode = 'file' | 'postgres' | 'dual';

export function authorityMode(): AuthorityMode {
  const m = process.env.MEMRAILS_AUTHORITY;
  if (m === 'postgres' || m === 'dual' || m === 'file') return m;
  // Configured Postgres location implies the flip; otherwise stay file-canonical.
  return process.env.MEMRAILS_PG_DIR ? 'postgres' : 'file';
}
