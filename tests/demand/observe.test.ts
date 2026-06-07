import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { observeIntent, markFulfilled, intentsPath } from '@/lib/demand/observe';
import { readAllEvents } from '@/lib/ledger/jsonl';
import type { IntentObservation } from '@/types/demand';

let dataDir: string;
const originalDataDir = process.env.DATA_DIR;

beforeEach(() => {
  dataDir = mkdtempSync(join(tmpdir(), 'memrails-demand-'));
  process.env.DATA_DIR = dataDir;
});

afterEach(() => {
  if (originalDataDir === undefined) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = originalDataDir;
  if (existsSync(dataDir)) rmSync(dataDir, { recursive: true, force: true });
});

function readIntents(): IntentObservation[] {
  const path = intentsPath();
  if (!existsSync(path)) return [];
  return readFileSync(path, 'utf8')
    .split('\n')
    .filter((l) => l.trim().length > 0)
    .map((l) => JSON.parse(l) as IntentObservation);
}

describe('observeIntent()', () => {
  it('appends an IntentObservation to data/demand/intents.jsonl', () => {
    const obs = observeIntent({ raw_text: 'what is the packet contract?', source: 'memory_query' });
    const lines = readIntents();
    expect(lines).toHaveLength(1);
    expect(lines[0].intent_id).toBe(obs.intent_id);
    expect(lines[0]._v).toBe(1);
    expect(lines[0].raw_text).toBe('what is the packet contract?');
    expect(lines[0].content_hash).toMatch(/^[0-9a-f]{16}$/);
  });

  it('produces the same content_hash for queries that normalize identically', () => {
    const a = observeIntent({ raw_text: 'packet contract', source: 'memory_query' });
    const b = observeIntent({ raw_text: 'Packet Contracts', source: 'memory_query' });
    expect(a.content_hash).toBe(b.content_hash);
    expect(a.intent_id).not.toBe(b.intent_id);
  });

  it('emits an INTENT_OBSERVED ledger event', () => {
    const obs = observeIntent({ raw_text: 'packet provenance', source: 'memory_query', actor_id: 'actor_a' });
    const events = readAllEvents().filter((e) => e.event_type === 'INTENT_OBSERVED');
    expect(events).toHaveLength(1);
    expect(events[0].metadata.intent_id).toBe(obs.intent_id);
    expect(events[0].metadata.content_hash).toBe(obs.content_hash);
    expect(events[0].metadata.source).toBe('memory_query');
    expect(events[0].actor_id).toBe('actor_a');
  });

  it('assigns an anonymous_fingerprint when actor_id is missing', () => {
    const obs = observeIntent({ raw_text: 'evidence floor', source: 'memory_query' });
    expect(obs.identity_type).toBe('anonymous_fingerprint');
    expect(obs.actor_id).toMatch(/^anon_[0-9a-f]{12}$/);
  });

  it('treats supplied actor_id as authenticated_account by default', () => {
    const obs = observeIntent({ raw_text: 'evidence floor', source: 'memory_query', actor_id: 'gh_user_42' });
    expect(obs.identity_type).toBe('authenticated_account');
    expect(obs.actor_id).toBe('gh_user_42');
  });

  it('honors an explicit identity_type override', () => {
    const obs = observeIntent({
      raw_text: 'contradictions',
      source: 'memory_query',
      actor_id: 'install_xyz',
      identity_type: 'anonymous_fingerprint',
    });
    expect(obs.identity_type).toBe('anonymous_fingerprint');
    expect(obs.actor_id).toBe('install_xyz');
  });
});

describe('markFulfilled()', () => {
  it('emits an INTENT_FULFILLED ledger event linking intent to packet', () => {
    markFulfilled('ti_abc123', 'pkt_xyz789', 'actor_a');
    const events = readAllEvents().filter((e) => e.event_type === 'INTENT_FULFILLED');
    expect(events).toHaveLength(1);
    expect(events[0].metadata.intent_id).toBe('ti_abc123');
    expect(events[0].metadata.packet_id).toBe('pkt_xyz789');
    expect(events[0].packet_id).toBe('pkt_xyz789');
    expect(events[0].actor_id).toBe('actor_a');
  });
});
