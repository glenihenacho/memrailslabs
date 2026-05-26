import { describe, it, expect } from 'vitest';
import { validateAddClaim } from '@/lib/refactor/validator';

describe('validateAddClaim', () => {
  it('passes a well-formed claim with evidence', () => {
    const v = validateAddClaim({
      claim: 'A real claim',
      evidence: ['https://example.com/source'],
      claim_id: 'clm_unique_phase3_validator_ok',
    });
    expect(v.ok).toBe(true);
    expect(v.issues).toEqual([]);
  });

  it('flags an empty claim', () => {
    const v = validateAddClaim({
      claim: '   ',
      evidence: ['https://example.com/source'],
      claim_id: 'clm_unique_phase3_validator_empty',
    });
    expect(v.ok).toBe(false);
    expect(v.issues).toContain('claim_text_empty');
  });

  it('flags missing evidence and zero stake', () => {
    const v = validateAddClaim({
      claim: 'unbacked claim',
      evidence: [],
      claim_id: 'clm_unique_phase3_validator_unbacked',
    });
    expect(v.issues).toContain('missing_evidence_and_stake');
  });

  it('accepts unbacked claim when stake > 0', () => {
    const v = validateAddClaim({
      claim: 'unbacked but staked',
      evidence: [],
      stake: 5,
      claim_id: 'clm_unique_phase3_validator_staked',
    });
    expect(v.issues).not.toContain('missing_evidence_and_stake');
  });

  it('flags collision with existing claim id', () => {
    const v = validateAddClaim({
      claim: 'collides',
      evidence: ['https://example.com/source'],
      claim_id: 'clm_packet_contract',
    });
    expect(v.issues).toContain('claim_id_collision');
  });
});
