import type { EvidenceClaim } from './evidence';

export type RefactorType =
  | 'ADD_CLAIM'
  | 'UPDATE_CONFIDENCE'
  | 'ADD_CONTRADICTION'
  | 'SPLIT_TOPIC'
  | 'DEPRECATE_STALE_CLAIM'
  | 'LINK_SOURCE';

export type RefactorStatus = 'proposed' | 'reviewing' | 'accepted' | 'rejected';

export type ValidatorReport = {
  ok: boolean;
  issues: string[];
};

export type RefactorProposal = {
  refactor_id: string;
  type: RefactorType;
  target_file?: string;
  target_claim_id?: string;
  proposed_diff: string;
  proposed_content: string;
  evidence: EvidenceClaim[];
  evidence_refs: string[];
  claim_text: string;
  claim_id: string;
  stake?: number;
  validator: ValidatorReport;
  status: RefactorStatus;
  reason?: string;
  applied_path?: string;
  created_at: string;
  updated_at: string;
};
