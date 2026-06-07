import { appendFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { dataRoot } from '@/lib/runtime';
import { logEvent } from '@/lib/ledger/events';
import { contentHash, normalize } from '@/lib/text/normalize';
import { isOptedIn } from './socket';
import type {
  DemandIntent,
  DemandSource,
  IdentityType,
  IntentObservation,
} from '@/types/demand';

export function intentsPath(): string {
  return resolve(dataRoot(), 'demand', 'intents.jsonl');
}

export type ObserveInput = {
  raw_text: string;
  source: DemandSource;
  actor_id?: string;
  identity_type?: IdentityType;
  session_id?: string;
};

const ANON_PREFIX = 'anon_';

function ensureActor(actor_id: string | undefined): {
  actor_id: string;
  identity_type: IdentityType;
} {
  if (actor_id && actor_id.length > 0) {
    return { actor_id, identity_type: 'authenticated_account' };
  }
  // Default to an ephemeral anonymous fingerprint when no actor is supplied.
  // Phase 2 wires real per-install fingerprints from the HTTP/MCP edges.
  const fingerprint = `${ANON_PREFIX}${randomUUID().replace(/-/g, '').slice(0, 12)}`;
  return { actor_id: fingerprint, identity_type: 'anonymous_fingerprint' };
}

export function observeIntent(input: ObserveInput): DemandIntent {
  const normalized = normalize(input.raw_text);
  const hash = contentHash(normalized);
  const observed_at = new Date().toISOString();
  const intent_id = `ti_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
  const { actor_id, identity_type } = ensureActor(input.actor_id);

  const consent_share = isOptedIn(actor_id, 'intents');

  const observation: IntentObservation = {
    _v: 1,
    intent_id,
    normalized_text: normalized,
    raw_text: input.raw_text,
    content_hash: hash,
    actor_id,
    identity_type: input.identity_type ?? identity_type,
    session_id: input.session_id,
    source: input.source,
    consent_share,
    observed_at,
  };

  appendObservation(observation);

  logEvent(
    'INTENT_OBSERVED',
    {
      intent_id,
      content_hash: hash,
      source: input.source,
      consent_share,
      normalized_preview: normalized.slice(0, 120),
    },
    { actor_id, session_id: input.session_id },
  );

  return observation;
}

export function markFulfilled(
  intent_id: string,
  packet_id: string,
  actor_id?: string,
  session_id?: string,
): void {
  logEvent(
    'INTENT_FULFILLED',
    { intent_id, packet_id },
    { actor_id, session_id, packet_id },
  );
}

function appendObservation(observation: IntentObservation): void {
  const path = intentsPath();
  if (!existsSync(dirname(path))) {
    mkdirSync(dirname(path), { recursive: true });
  }
  appendFileSync(path, `${JSON.stringify(observation)}\n`, 'utf8');
}
