import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve, sep } from 'node:path';
import { findClaim, knowledgeDir, loadCorpus } from '@/lib/memory/corpus';
import { logEvent } from '@/lib/ledger/events';
import type { EvidenceClaim } from '@/types/evidence';
import type { RefactorProposal } from '@/types/refactor';
import { buildAddClaimDiff, buildAddClaimMarkdown } from './diff';
import { loadRefactor, saveRefactor } from './store';
import { claimSlug, slugToClaimId } from './slug';
import { validateAddClaim } from './validator';

const DEFAULT_CONFIDENCE = 0.6;

export class ProposalRejected extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = 'ProposalRejected';
  }
}

export class RefactorNotFound extends Error {
  constructor(refactor_id: string) {
    super(`refactor_not_found: ${refactor_id}`);
    this.name = 'RefactorNotFound';
  }
}

export class InvalidTransition extends Error {
  constructor(from: string, to: string) {
    super(`invalid_transition: ${from} -> ${to}`);
    this.name = 'InvalidTransition';
  }
}

export type ProposeInput = {
  claim: string;
  evidence?: string[];
  target_file?: string;
  stake?: number;
};

function isInKnowledgeDir(rel: string): boolean {
  const full = resolve(process.cwd(), rel);
  const base = knowledgeDir();
  return full === base || full.startsWith(base + sep);
}

export function proposeRefactor(input: ProposeInput): RefactorProposal {
  const claim_text = input.claim.trim();
  const evidence_refs = (input.evidence ?? [])
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const slug = claimSlug(claim_text);
  const claim_id = slugToClaimId(slug);
  const target_file = input.target_file ?? `knowledge/claims/${slug}.md`;

  if (!isInKnowledgeDir(target_file)) {
    throw new ProposalRejected('target_file_outside_knowledge');
  }

  const now = new Date().toISOString();
  const proposed_content = buildAddClaimMarkdown({
    claim_id,
    claim_text,
    confidence: DEFAULT_CONFIDENCE,
    evidence_urls: evidence_refs,
    created_at: now.slice(0, 10),
  });
  const proposed_diff = buildAddClaimDiff(target_file, proposed_content);

  const resolved_evidence: EvidenceClaim[] = [];
  for (const ref of evidence_refs) {
    try {
      const hit = findClaim(ref);
      if (hit) resolved_evidence.push(hit);
    } catch {
      // ignore
    }
  }

  const validator = validateAddClaim({
    claim: claim_text,
    evidence: evidence_refs,
    stake: input.stake,
    claim_id,
  });

  const refactor_id = `ref_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
  const proposal: RefactorProposal = {
    refactor_id,
    type: 'ADD_CLAIM',
    target_file,
    target_claim_id: claim_id,
    proposed_diff,
    proposed_content,
    evidence: resolved_evidence,
    evidence_refs,
    claim_text,
    claim_id,
    stake: input.stake,
    validator,
    status: 'proposed',
    created_at: now,
    updated_at: now,
  };

  saveRefactor(proposal);
  logEvent('REFACTOR_PROPOSED', {
    refactor_id,
    type: proposal.type,
    target_file,
    validator_ok: validator.ok,
    issues: validator.issues,
  });
  return proposal;
}

export function acceptRefactor(refactor_id: string): RefactorProposal {
  const prop = loadRefactor(refactor_id);
  if (!prop) throw new RefactorNotFound(refactor_id);
  if (prop.status === 'accepted') return prop;
  if (prop.status === 'rejected') throw new InvalidTransition('rejected', 'accepted');
  if (prop.type !== 'ADD_CLAIM') {
    throw new ProposalRejected(`type_deferred: ${prop.type}`);
  }
  if (!prop.target_file || !isInKnowledgeDir(prop.target_file)) {
    throw new ProposalRejected('target_outside_knowledge');
  }

  const fullPath = resolve(process.cwd(), prop.target_file);
  const dir = dirname(fullPath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(fullPath, prop.proposed_content, 'utf8');

  prop.status = 'accepted';
  prop.applied_path = prop.target_file;
  prop.updated_at = new Date().toISOString();
  saveRefactor(prop);
  loadCorpus({ force: true });

  logEvent('REFACTOR_ACCEPTED', {
    refactor_id,
    applied_path: prop.applied_path,
  });
  return prop;
}

export function rejectRefactor(refactor_id: string, reason?: string): RefactorProposal {
  const prop = loadRefactor(refactor_id);
  if (!prop) throw new RefactorNotFound(refactor_id);
  if (prop.status === 'rejected') return prop;
  if (prop.status === 'accepted') throw new InvalidTransition('accepted', 'rejected');

  prop.status = 'rejected';
  prop.reason = reason;
  prop.updated_at = new Date().toISOString();
  saveRefactor(prop);

  logEvent('REFACTOR_REJECTED', { refactor_id, reason });
  return prop;
}
