/**
 * Artifact Rail (C4.2) — packets, evidence, exports, snapshots.
 *
 * Bodies are **content-addressed** (`artifact://sha256/<hex>`, the same
 * `sha256:` scheme `MemorySourceRef.hash` uses) and **encrypted at rest**
 * (AES-256-GCM; key from `MEMRAILS_ARTIFACT_KEY` or a generated local dev
 * keyfile). Postgres stores **pointers only** (`artifacts` table) — the blob
 * store holds ciphertext, the authority holds the map.
 *
 * The MVP persists to the local filesystem (`data/artifacts/`); a real deploy
 * swaps in S3 / R2 / MinIO behind the same `put`/`get`/`putContent`
 * interface. The archive consumer (`artifactArchiveConsumer`) is a C3 spine
 * consumer: on each MEMORY_RETRIEVED event it archives the bundle from the
 * `retrievals` table — droppable and rebuildable, Postgres wins all
 * disagreements.
 */

import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { dataPath } from '@/lib/paths';
import type { LedgerEvent } from '@/types/ledger';
import type { LedgerConsumer } from '@/lib/ledger/consumers';
import { getDb } from '@/lib/memory/authority/client';
import { persistArtifactPointer } from '@/lib/memory/authority/persist';
import { authorityMode } from '@/lib/memory/authority/mode';

export interface ArtifactRail {
  put(ownerId: string, key: string, body: string): string;
  get(ref: string): string | null;
  /** Content-addressed put: ref is derived from the plaintext sha256. */
  putContent(ownerId: string, body: string): { ref: string; hash: string; bytes: number };
}

const MAGIC = Buffer.from('MRA1'); // encrypted-at-rest envelope marker

function sha256Hex(body: string): string {
  return createHash('sha256').update(body, 'utf8').digest('hex');
}

/** AES-256-GCM key: env (64 hex chars) or a generated local dev keyfile. */
function artifactKey(): Buffer {
  const env = process.env.MEMRAILS_ARTIFACT_KEY;
  if (env && /^[0-9a-f]{64}$/i.test(env)) return Buffer.from(env, 'hex');
  const keyfile = dataPath('artifacts', '.key');
  if (existsSync(keyfile)) return Buffer.from(readFileSync(keyfile, 'utf8').trim(), 'hex');
  const key = randomBytes(32);
  if (!existsSync(dirname(keyfile))) mkdirSync(dirname(keyfile), { recursive: true });
  writeFileSync(keyfile, key.toString('hex'), { encoding: 'utf8', mode: 0o600 });
  return key;
}

function encrypt(body: string): Buffer {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', artifactKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(body, 'utf8'), cipher.final()]);
  return Buffer.concat([MAGIC, iv, cipher.getAuthTag(), ciphertext]);
}

function decrypt(blob: Buffer): string {
  if (blob.length < 32 || !blob.subarray(0, 4).equals(MAGIC)) {
    // Pre-C4 plaintext artifact — still readable.
    return blob.toString('utf8');
  }
  const iv = blob.subarray(4, 16);
  const tag = blob.subarray(16, 32);
  const decipher = createDecipheriv('aes-256-gcm', artifactKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(blob.subarray(32)), decipher.final()]).toString('utf8');
}

class FileArtifactRail implements ArtifactRail {
  private base(): string {
    return dataPath('artifacts');
  }

  /** Resolve `rel` under the artifact base, rejecting any traversal escape. */
  private resolveWithinBase(rel: string): string {
    const base = resolve(this.base());
    const abs = resolve(base, rel);
    if (abs !== base && !abs.startsWith(base + sep)) {
      throw new Error('invalid_artifact_path');
    }
    return abs;
  }

  private write(rel: string, body: string): string {
    const abs = this.resolveWithinBase(rel);
    if (!existsSync(dirname(abs))) mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, encrypt(body));
    return `artifact://${rel}`;
  }

  put(ownerId: string, key: string, body: string): string {
    const ref = this.write(join(ownerId, key), body);
    if (authorityMode() !== 'file') {
      persistArtifactPointer({
        ref,
        hash: `sha256:${sha256Hex(body)}`,
        owner_id: ownerId,
        bytes: Buffer.byteLength(body),
      });
    }
    return ref;
  }

  putContent(ownerId: string, body: string): { ref: string; hash: string; bytes: number } {
    const hex = sha256Hex(body);
    const rel = join('sha256', hex);
    const abs = this.resolveWithinBase(rel);
    const ref = `artifact://${rel}`;
    const bytes = Buffer.byteLength(body);
    if (!existsSync(abs)) this.write(rel, body); // content-addressed: dedupe by hash
    if (authorityMode() !== 'file') {
      persistArtifactPointer({ ref, hash: `sha256:${hex}`, owner_id: ownerId, bytes });
    }
    return { ref, hash: `sha256:${hex}`, bytes };
  }

  get(ref: string): string | null {
    if (!ref.startsWith('artifact://')) return null;
    const rel = ref.slice('artifact://'.length);
    const abs = this.resolveWithinBase(rel);
    return existsSync(abs) ? decrypt(readFileSync(abs)) : null;
  }
}

export const artifactRail: ArtifactRail = new FileArtifactRail();

/**
 * Archive consumer: on each retrieval event, pull the bundle from the
 * `retrievals` table (Postgres is the source of truth) and store it as a
 * content-addressed encrypted artifact with a pointer row. Dropping the blob
 * store and re-running this consumer reproduces the identical hashes.
 */
export function artifactArchiveConsumer(rail: ArtifactRail = artifactRail): LedgerConsumer {
  return {
    name: 'rail_artifact_archive',
    async handle(event: LedgerEvent) {
      if (event.event_type !== 'MEMORY_RETRIEVED' || !event.retrieval_id) return;
      const db = await getDb();
      const res = await db.query<{ bundle: unknown }>(
        'SELECT bundle FROM retrievals WHERE retrieval_id = $1',
        [event.retrieval_id],
      );
      if (res.rows.length === 0) return; // no bundle row → nothing to archive
      rail.putContent(event.owner_id ?? 'system', JSON.stringify(res.rows[0].bundle));
    },
  };
}
