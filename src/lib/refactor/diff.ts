export type AddClaimMarkdownInput = {
  claim_id: string;
  claim_text: string;
  confidence: number;
  evidence_urls: string[];
  created_at: string;
};

function escapeYamlScalar(s: string): string {
  if (/[:#\n"'\\]/.test(s) || /^\s|\s$/.test(s)) {
    return JSON.stringify(s);
  }
  return s;
}

export function buildAddClaimMarkdown(input: AddClaimMarkdownInput): string {
  const lines: string[] = [];
  lines.push('---');
  lines.push(`id: ${input.claim_id}`);
  lines.push(`confidence: ${input.confidence}`);
  lines.push('tags: []');
  if (input.evidence_urls.length > 0) {
    lines.push('evidence_urls:');
    for (const u of input.evidence_urls) {
      lines.push(`  - ${escapeYamlScalar(u)}`);
    }
  }
  lines.push(`created_at: ${input.created_at}`);
  lines.push(`updated_at: ${input.created_at}`);
  lines.push(`claim: ${escapeYamlScalar(input.claim_text)}`);
  lines.push('---');
  lines.push('');
  lines.push('# Proposed claim');
  lines.push('');
  lines.push(input.claim_text);
  lines.push('');
  return lines.join('\n');
}

export function buildAddClaimDiff(target_path: string, content: string): string {
  const bodyLines = content.split('\n');
  // Trailing newline produces a trailing empty element; drop it for the hunk count.
  const n =
    bodyLines.length > 0 && bodyLines[bodyLines.length - 1] === ''
      ? bodyLines.length - 1
      : bodyLines.length;

  const out: string[] = [];
  out.push('--- /dev/null');
  out.push(`+++ b/${target_path}`);
  out.push(`@@ -0,0 +1,${n} @@`);
  for (let i = 0; i < n; i++) {
    out.push(`+${bodyLines[i]}`);
  }
  return out.join('\n');
}
