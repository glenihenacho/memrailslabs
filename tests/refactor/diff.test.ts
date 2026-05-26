import { describe, it, expect } from 'vitest';
import { buildAddClaimDiff, buildAddClaimMarkdown } from '@/lib/refactor/diff';

describe('buildAddClaimMarkdown', () => {
  it('produces a frontmatter + body document', () => {
    const out = buildAddClaimMarkdown({
      claim_id: 'clm_test_one',
      claim_text: 'A simple claim',
      confidence: 0.6,
      evidence_urls: ['https://example.com/a'],
      created_at: '2026-05-26',
    });
    expect(out).toContain('---\nid: clm_test_one');
    expect(out).toContain('confidence: 0.6');
    expect(out).toContain('evidence_urls:');
    expect(out).toContain('  - "https://example.com/a"');
    expect(out).toContain('# Proposed claim');
    expect(out).toContain('A simple claim');
    expect(out.endsWith('\n')).toBe(true);
  });

  it('JSON-quotes claim text with reserved YAML chars', () => {
    const out = buildAddClaimMarkdown({
      claim_id: 'clm_x',
      claim_text: 'has a: colon',
      confidence: 0.5,
      evidence_urls: [],
      created_at: '2026-05-26',
    });
    expect(out).toContain('claim: "has a: colon"');
  });
});

describe('buildAddClaimDiff', () => {
  it('emits a /dev/null → target unified diff with correct hunk count', () => {
    const content = 'line one\nline two\n';
    const diff = buildAddClaimDiff('knowledge/claims/foo.md', content);
    expect(diff).toMatch(/^--- \/dev\/null\n\+\+\+ b\/knowledge\/claims\/foo\.md\n@@ -0,0 \+1,2 @@\n\+line one\n\+line two$/);
  });

  it('matches the markdown line count exactly', () => {
    const content = buildAddClaimMarkdown({
      claim_id: 'clm_x',
      claim_text: 'hi',
      confidence: 0.6,
      evidence_urls: [],
      created_at: '2026-05-26',
    });
    const diff = buildAddClaimDiff('knowledge/claims/x.md', content);
    const hunkMatch = diff.match(/@@ -0,0 \+1,(\d+) @@/);
    expect(hunkMatch).toBeTruthy();
    const declared = Number(hunkMatch![1]);
    const added = diff.split('\n').filter((l) => l.startsWith('+') && !l.startsWith('+++')).length;
    expect(added).toBe(declared);
  });
});
