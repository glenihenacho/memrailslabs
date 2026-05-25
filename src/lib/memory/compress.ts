import type { EvidenceClaim } from '@/types/evidence';

const DEFAULT_MAX_TOKENS = 600;

/**
 * L5 — Fallback synthesis. Builds a compact summary out of L4-filtered
 * candidates. Never invents claims; tags low-coverage answers as uncertain
 * (`§2 Rule 3`, `§7 L5 acceptance`).
 */
export function compressLayer(
  query: string,
  candidates: EvidenceClaim[],
  maxTokens: number = DEFAULT_MAX_TOKENS,
): { packet: string; tokens: number; compressor: string } {
  const compressor = 'compress-v1-stub';

  if (candidates.length === 0) {
    const packet = `[uncertain] No evidence above the confidence floor was found for the query "${query}". Add a claim to /knowledge or lower the evidence floor to surface lower-confidence material.`;
    return { packet, tokens: estimateTokens(packet), compressor };
  }

  const header = `Query: ${query}`;
  const findings = candidates
    .slice(0, 8)
    .map((c, idx) => {
      const conf = (c.confidence * 100).toFixed(0);
      return `${idx + 1}. ${c.claim} (${conf}% — ${c.id} · ${c.source_file})`;
    })
    .join('\n');

  let body = `${header}\n\n${findings}`;
  body = clampToTokens(body, maxTokens);

  const lowCoverage = candidates.every((c) => c.confidence < 0.85);
  if (lowCoverage) {
    body += '\n\n[uncertain] All cited evidence sits below 0.85 confidence. Treat as provisional.';
  }

  return { packet: body, tokens: estimateTokens(body), compressor };
}

export function estimateTokens(text: string): number {
  // Rough heuristic: ~4 chars per token. Avoids pulling in a tokenizer library.
  return Math.ceil(text.length / 4);
}

function clampToTokens(text: string, maxTokens: number): string {
  const tokens = estimateTokens(text);
  if (tokens <= maxTokens) return text;
  const ratio = maxTokens / tokens;
  return `${text.slice(0, Math.floor(text.length * ratio)).trim()}…`;
}
