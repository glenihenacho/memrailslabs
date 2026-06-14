/**
 * Federated NoSQL infrastructure plane — one account namespace per owner.
 *
 * Three planes:
 *   - SQL = government   — authority: registry, scope, policy, audit, metering,
 *                          and placement (owner → namespace mapping).
 *   - MemoryIndex = protocol — the retrieval contract; reads within a namespace.
 *   - Federated NoSQL accounts = infrastructure — one NoSQL account namespace
 *                          per owner/email, stitched into one logical store.
 *
 * Each owner (keyed by email at enrollment) gets an isolated account namespace.
 * Government resolves the namespace; the protocol retrieves inside it; the user
 * never brings or sees accounts. The MVP backs each namespace with a file
 * directory; a real NoSQL account (Mongo/Couchbase/Scylla per-tenant database)
 * joins by implementing a provider — nothing above this plane changes.
 *
 * No tiers, no pools — a flat per-owner federation governed from above.
 */

import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { dataPath } from '@/lib/paths';

export type FederatedAccountStatus = 'active' | 'readonly' | 'draining';

export type FederatedAccount = {
  account_id: string;
  owner_id: string;
  /** Logical namespace locator. */
  namespace: string;
  /** Backend provider, e.g. `file:federation/<owner>`, later `mongo:<db>`. */
  provider: string;
  status: FederatedAccountStatus;
};

function accountId(owner_id: string): string {
  return `acct_${owner_id}`;
}

export function namespaceDir(owner_id: string): string {
  return dataPath('federation', owner_id);
}

export class Federation {
  /** The owner's account (pure mapping; does not touch disk). */
  accountFor(owner_id: string): FederatedAccount {
    return {
      account_id: accountId(owner_id),
      owner_id,
      namespace: `federation/${owner_id}`,
      provider: `file:federation/${owner_id}`,
      status: 'active',
    };
  }

  /** Provision the owner's namespace (idempotent). Called at enrollment. */
  provision(owner_id: string): FederatedAccount {
    const dir = namespaceDir(owner_id);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    return this.accountFor(owner_id);
  }

  /** SQL governs placement; a record lives in its owner's namespace. */
  resolve(record: { scope: { owner_id: string } }): FederatedAccount {
    return this.accountFor(record.scope.owner_id);
  }

  /** All provisioned namespaces in the federation. */
  list(): FederatedAccount[] {
    const base = dataPath('federation');
    if (!existsSync(base)) return [];
    return readdirSync(base).map((owner) => this.accountFor(owner));
  }

  /** Accounts a retrieval reads across — one owner namespace. */
  touchedByRetrieval(owner_id: string): string[] {
    return [accountId(owner_id)];
  }
}

export const federation = new Federation();
