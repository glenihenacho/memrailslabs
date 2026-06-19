import { rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, it, expect } from 'vitest';
import { enroll, findByApiKey, invalidateAccounts } from '@/lib/accounts/store';
import { authenticate, requireOwner, AuthError, DEMO_OWNER } from '@/lib/auth/authenticate';
import { invalidateRegistry } from '@/lib/memory/registry';

function reset() {
  rmSync(resolve(__dirname, '../../.tmp-test-data'), { recursive: true, force: true });
  invalidateAccounts();
  invalidateRegistry();
}

function req(authHeader?: string): Request {
  return new Request('http://localhost/api', {
    headers: authHeader ? { authorization: authHeader } : {},
  });
}

describe('API-key authentication', () => {
  beforeEach(reset);

  it('resolves an account by its issued API key', () => {
    const acct = enroll('owner@example.com');
    const found = findByApiKey(acct.api_key);
    expect(found?.owner_id).toBe(acct.owner_id);
    expect(findByApiKey('mr_does_not_exist')).toBeNull();
  });

  it('treats no key as the read-only demo tenant', () => {
    const auth = authenticate(req());
    expect(auth.demo).toBe(true);
    expect(auth.owner_id).toBe(DEMO_OWNER);
  });

  it('resolves a valid Bearer key to its owner', () => {
    const acct = enroll('dev@example.com');
    const auth = authenticate(req(`Bearer ${acct.api_key}`));
    expect(auth.demo).toBe(false);
    expect(auth.owner_id).toBe(acct.owner_id);
  });

  it('rejects an unknown key with 401', () => {
    expect(() => authenticate(req('Bearer mr_bogus'))).toThrow(AuthError);
    try {
      authenticate(req('Bearer mr_bogus'));
    } catch (e) {
      expect((e as AuthError).status).toBe(401);
    }
  });

  it('requireOwner rejects the demo tenant for mutations', () => {
    expect(() => requireOwner(req())).toThrow(AuthError);
    const acct = enroll('writer@example.com');
    expect(requireOwner(req(`Bearer ${acct.api_key}`))).toBe(acct.owner_id);
  });
});
