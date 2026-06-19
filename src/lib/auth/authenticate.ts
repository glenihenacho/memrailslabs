/**
 * API-key authentication for the memory API.
 *
 * Bearer key → owner. No key → the read-only public **demo** tenant
 * (`user_memrails`, which owns the curated corpus) so the live console keeps
 * working without credentials. Mutations and access to any real tenant require
 * a valid key; a key is the only way to resolve a non-demo owner, so one tenant
 * can never reach another's memory.
 */

import { NextResponse } from 'next/server';
import { findByApiKey } from '@/lib/accounts/store';

/** The curated corpus / public read-only demo tenant. */
export const DEMO_OWNER = 'user_memrails';

export type Auth = { owner_id: string; demo: boolean };

export class AuthError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function bearer(req: Request): string | null {
  const header = req.headers.get('authorization') ?? '';
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match ? match[1].trim() : null;
}

/**
 * Resolve the caller. No key → the demo tenant (read-only). A present-but-unknown
 * key is rejected (401). A valid key resolves to that owner.
 */
export function authenticate(req: Request): Auth {
  const key = bearer(req);
  if (!key) return { owner_id: DEMO_OWNER, demo: true };
  const account = findByApiKey(key);
  if (!account) throw new AuthError(401, 'invalid_api_key');
  return { owner_id: account.owner_id, demo: false };
}

/** Mutations require a real (non-demo) authenticated owner. */
export function requireOwner(req: Request): string {
  const auth = authenticate(req);
  if (auth.demo) throw new AuthError(401, 'authentication_required');
  return auth.owner_id;
}

/** Map an AuthError to a JSON response; rethrow anything else. */
export function authErrorResponse(err: unknown): NextResponse {
  if (err instanceof AuthError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  throw err;
}
