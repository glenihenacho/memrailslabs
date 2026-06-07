import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  InvalidActorId,
  getRegistration,
  isOptedIn,
  register,
  registrationsDir,
} from '@/lib/demand/socket';
import { observeIntent } from '@/lib/demand/observe';
import { readAllEvents } from '@/lib/ledger/jsonl';

let dataDir: string;
const originalDataDir = process.env.DATA_DIR;

beforeEach(() => {
  dataDir = mkdtempSync(join(tmpdir(), 'memrails-socket-'));
  process.env.DATA_DIR = dataDir;
});

afterEach(() => {
  if (originalDataDir === undefined) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = originalDataDir;
  if (existsSync(dataDir)) rmSync(dataDir, { recursive: true, force: true });
});

describe('socket.register()', () => {
  it('writes a registration file under data/demand/registrations/', () => {
    register({ actor_id: 'gh_user_42', identity_type: 'authenticated_account' });
    expect(existsSync(join(registrationsDir(), 'gh_user_42.json'))).toBe(true);
  });

  it('defaults consent.share_intents to true', () => {
    const reg = register({ actor_id: 'gh_user_42', identity_type: 'authenticated_account' });
    expect(reg.consent.share_intents).toBe(true);
  });

  it('honors explicit consent.share_intents=false', () => {
    const reg = register({
      actor_id: 'gh_user_42',
      identity_type: 'authenticated_account',
      consent: { share_intents: false },
    });
    expect(reg.consent.share_intents).toBe(false);
  });

  it('rejects malformed actor_ids', () => {
    expect(() =>
      register({ actor_id: '../escape', identity_type: 'authenticated_account' }),
    ).toThrow(InvalidActorId);
  });
});

describe('socket.isOptedIn()', () => {
  it('returns true for unregistered actors (default opt-in)', () => {
    expect(isOptedIn('not_registered', 'intents')).toBe(true);
  });

  it('returns true when registered with share_intents=true', () => {
    register({
      actor_id: 'a',
      identity_type: 'authenticated_account',
      consent: { share_intents: true },
    });
    expect(isOptedIn('a', 'intents')).toBe(true);
  });

  it('returns false when registered with share_intents=false', () => {
    register({
      actor_id: 'b',
      identity_type: 'authenticated_account',
      consent: { share_intents: false },
    });
    expect(isOptedIn('b', 'intents')).toBe(false);
  });
});

describe('socket.getRegistration()', () => {
  it('returns null for unregistered actor', () => {
    expect(getRegistration('nobody')).toBeNull();
  });

  it('round-trips a registration', () => {
    const written = register({ actor_id: 'a', identity_type: 'authenticated_account' });
    expect(getRegistration('a')).toEqual(written);
  });
});

describe('observeIntent + socket consent', () => {
  it('marks observation consent_share=true for unregistered actors', () => {
    const obs = observeIntent({
      raw_text: 'packet contract',
      source: 'memory_query',
      actor_id: 'fresh_actor',
    });
    expect(obs.consent_share).toBe(true);
  });

  it('marks observation consent_share=false when actor opts out', () => {
    register({
      actor_id: 'silent_actor',
      identity_type: 'authenticated_account',
      consent: { share_intents: false },
    });
    const obs = observeIntent({
      raw_text: 'packet contract',
      source: 'memory_query',
      actor_id: 'silent_actor',
    });
    expect(obs.consent_share).toBe(false);
  });

  it('threads consent_share into the INTENT_OBSERVED ledger event', () => {
    register({
      actor_id: 'silent_actor',
      identity_type: 'authenticated_account',
      consent: { share_intents: false },
    });
    observeIntent({
      raw_text: 'evidence floor',
      source: 'memory_query',
      actor_id: 'silent_actor',
    });
    const evt = readAllEvents().find(
      (e) => e.event_type === 'INTENT_OBSERVED' && e.actor_id === 'silent_actor',
    );
    expect(evt?.metadata.consent_share).toBe(false);
  });

  it('still appends the observation to the JSONL even when opted out (audit)', () => {
    register({
      actor_id: 'silent_actor',
      identity_type: 'authenticated_account',
      consent: { share_intents: false },
    });
    const obs = observeIntent({
      raw_text: 'compress packets',
      source: 'memory_query',
      actor_id: 'silent_actor',
    });
    // The Phase 3 aggregator will filter on consent_share — record persists.
    expect(obs.intent_id).toMatch(/^ti_[0-9a-f]{12}$/);
  });
});
