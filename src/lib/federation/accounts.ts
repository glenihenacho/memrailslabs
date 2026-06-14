/**
 * Federated NoSQL infrastructure plane.
 *
 * Three planes, cleanly separated:
 *   - SQL = government   — authority: registry, scope, policy, audit, metering,
 *                          and placement (which account holds a memory body).
 *   - MemoryIndex = protocol — the retrieval contract; selects relevant memory
 *                          independent of where it physically lives.
 *   - Federated NoSQL accounts = infrastructure — memory bodies live across a
 *                          federation of NoSQL accounts, stitched into one
 *                          logical store.
 *
 * The user never sees or brings accounts. SQL decides placement; the protocol
 * reads across the federation; this layer just holds bytes. The default is
 * file-canonical — real NoSQL accounts (Mongo, Couchbase, Scylla, …) join the
 * federation by implementing a provider, with nothing above this line changing.
 *
 * No tiers, no pools — a flat federation governed from above.
 */

export type FederatedAccountStatus = 'active' | 'readonly' | 'draining';

export type FederatedAccount = {
  account_id: string;
  /** Backend locator, e.g. `file:knowledge`, later `mongo:atlas-xxx`. */
  provider: string;
  /** `canonical` = curated corpus; `writable` = agent-written memory. */
  role: 'canonical' | 'writable';
  status: FederatedAccountStatus;
};

/**
 * The federation membership. SQL (government) is authority over *placement*;
 * these accounts are the infrastructure that physically stores memory bodies.
 */
const DEFAULT_FEDERATION: FederatedAccount[] = [
  { account_id: 'acct_canonical', provider: 'file:knowledge', role: 'canonical', status: 'active' },
  { account_id: 'acct_written', provider: 'file:written-memory.jsonl', role: 'writable', status: 'active' },
];

export class Federation {
  constructor(private readonly accounts: FederatedAccount[] = DEFAULT_FEDERATION) {}

  list(): FederatedAccount[] {
    return this.accounts;
  }

  byRole(role: FederatedAccount['role']): FederatedAccount {
    const account = this.accounts.find((a) => a.role === role && a.status !== 'draining');
    if (!account) throw new Error(`no_federated_account_for_role:${role}`);
    return account;
  }

  /**
   * Resolve which NoSQL account physically holds a record's body. In production
   * this is read from the SQL `storage_ref`; in the MVP it is derived from the
   * record's source.
   */
  resolve(record: { source_file: string }): FederatedAccount {
    return record.source_file.includes('written-memory')
      ? this.byRole('writable')
      : this.byRole('canonical');
  }

  /** Accounts a retrieval reads across — used for internal cost accounting. */
  touchedByRetrieval(): string[] {
    return this.accounts.filter((a) => a.status === 'active').map((a) => a.account_id);
  }
}

export const federation = new Federation();
