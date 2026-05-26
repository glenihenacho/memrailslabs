import { findClaim } from '@/lib/memory/corpus';
import type { ValidatorReport } from '@/types/refactor';

export type AddClaimValidationInput = {
  claim: string;
  evidence: string[];
  stake?: number;
  claim_id: string;
};

export function validateAddClaim(input: AddClaimValidationInput): ValidatorReport {
  const issues: string[] = [];
  const trimmed = input.claim.trim();
  if (trimmed.length === 0) issues.push('claim_text_empty');
  if (trimmed.length > 4000) issues.push('claim_text_too_long');

  const hasEvidence = (input.evidence?.length ?? 0) > 0;
  const hasStake = (input.stake ?? 0) > 0;
  if (!hasEvidence && !hasStake) issues.push('missing_evidence_and_stake');

  try {
    if (findClaim(input.claim_id)) issues.push('claim_id_collision');
  } catch {
    // Corpus unavailable in this context; skip the collision check.
  }

  return { ok: issues.length === 0, issues };
}
