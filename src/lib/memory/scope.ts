import type { MemoryRecord, MemoryScope } from '@/types/governed';

export type ScopeRequest = {
  owner_id: string;
  project_id: string;
  agent_id?: string | null;
  include_disputed?: boolean;
};

export type PolicyDecision = {
  allowed: boolean;
  reason: string;
};

/**
 * Policy gate. Runs before retrieval ranks anything. Mirrors the production
 * checks: ownership → project scope → status → sensitivity → expiry.
 * Returns a reason on rejection so the Console can explain every omission.
 */
export function evaluatePolicy(record: MemoryRecord, req: ScopeRequest): PolicyDecision {
  if (record.scope.owner_id !== req.owner_id) {
    return { allowed: false, reason: 'owner_scope' };
  }
  if (record.scope.project_id !== req.project_id) {
    return { allowed: false, reason: 'project_scope' };
  }
  // Agent-scoped memory is only visible to that agent; project-wide
  // (agent_id null) memory is visible to every agent in the project.
  if (record.scope.agent_id && req.agent_id && record.scope.agent_id !== req.agent_id) {
    return { allowed: false, reason: 'agent_scope' };
  }
  if (record.status === 'tombstoned') {
    return { allowed: false, reason: 'tombstoned' };
  }
  if (record.status === 'superseded') {
    return { allowed: false, reason: 'superseded' };
  }
  if (record.status === 'disputed' && !req.include_disputed) {
    return { allowed: false, reason: 'disputed' };
  }
  // Restricted memory is suppressed unless explicitly requested by a future
  // sensitivity-scoped flag; sensitive (but not restricted) memory still flows.
  if (record.sensitivity === 'restricted') {
    return { allowed: false, reason: 'restricted_sensitivity' };
  }
  if (record.expires_at) {
    const expiresAtMs = Date.parse(record.expires_at);
    // An unparseable expiry is treated as expired rather than silently allowed.
    if (Number.isNaN(expiresAtMs) || expiresAtMs < Date.now()) {
      return { allowed: false, reason: 'expired' };
    }
  }
  return { allowed: true, reason: 'in_scope' };
}

export const POLICY_FILTERS = [
  'owner_scope',
  'project_scope',
  'agent_scope',
  'active_only',
  'sensitivity',
  'expiry',
] as const;

export function defaultScope(req: Partial<MemoryScope>): ScopeRequest {
  return {
    owner_id: req.owner_id ?? 'user_memrails',
    project_id: req.project_id ?? 'project_memrails',
    agent_id: req.agent_id ?? null,
  };
}
