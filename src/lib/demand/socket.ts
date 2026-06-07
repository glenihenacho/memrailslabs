import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { dataRoot } from '@/lib/runtime';
import type { IdentityType, SocketRegistration } from '@/types/demand';

const ACTOR_ID_PATTERN = /^[a-z0-9_:.-]{1,128}$/i;

export function registrationsDir(): string {
  return resolve(dataRoot(), 'demand', 'registrations');
}

function ensureDir(): void {
  const dir = registrationsDir();
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function registrationPath(actor_id: string): string {
  // ACTOR_ID_PATTERN already rejects path traversal; resolve is belt-and-suspenders.
  return resolve(registrationsDir(), `${actor_id}.json`);
}

export type RegisterInput = {
  actor_id: string;
  identity_type: IdentityType;
  consent?: { share_intents?: boolean };
};

export function register(input: RegisterInput): SocketRegistration {
  if (!ACTOR_ID_PATTERN.test(input.actor_id)) {
    throw new InvalidActorId(input.actor_id);
  }
  ensureDir();
  const registration: SocketRegistration = {
    actor_id: input.actor_id,
    identity_type: input.identity_type,
    consent: { share_intents: input.consent?.share_intents ?? true },
    registered_at: new Date().toISOString(),
  };
  writeFileSync(registrationPath(input.actor_id), `${JSON.stringify(registration, null, 2)}\n`, 'utf8');
  return registration;
}

export function getRegistration(actor_id: string): SocketRegistration | null {
  if (!ACTOR_ID_PATTERN.test(actor_id)) return null;
  const path = registrationPath(actor_id);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as SocketRegistration;
  } catch {
    return null;
  }
}

// Default policy: unregistered actors share by default, so the lake fills as
// observations flow through. Explicit registration with `share_intents: false`
// flips the consent bit to off; the observation still lands in the ledger
// (audit) but the Phase 3 aggregator filters it out.
export function isOptedIn(actor_id: string, scope: 'intents'): boolean {
  const reg = getRegistration(actor_id);
  if (!reg) return true;
  if (scope === 'intents') return reg.consent.share_intents;
  return true;
}

export class InvalidActorId extends Error {
  actor_id: string;
  constructor(actor_id: string) {
    super(`invalid_actor_id: ${actor_id}`);
    this.name = 'InvalidActorId';
    this.actor_id = actor_id;
  }
}
