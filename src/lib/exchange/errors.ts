/**
 * Thrown by every Phase 5 stub method. The real auction/payout engine is
 * out of scope for the foundation — these surfaces exist so the
 * downstream wiring (which events fire, which types the result carries)
 * is visible and reviewable before the implementation lands.
 */
export class NotImplemented extends Error {
  method: string;
  constructor(method: string) {
    super(
      `exchange_not_implemented: ${method} — the auction/payout engine has not been built yet. ` +
        `The foundation (Phases 0–4) ships the demand index; this surface is reserved.`,
    );
    this.name = 'NotImplemented';
    this.method = method;
  }
}
