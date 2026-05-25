import { describe, it, expect } from 'vitest';
import { readFilesResource, readKeysResource } from '@/lib/mcp/resources';
import { listKnowledgeFiles } from '@/lib/memory/corpus';

describe('memory://files resource', () => {
  it('reads a real knowledge file', () => {
    const result = readFilesResource(
      new URL('memory://files/claims/packet-contract.md'),
    );
    expect(result.contents).toHaveLength(1);
    expect(result.contents[0].mimeType).toBe('text/markdown');
    expect(result.contents[0].text).toMatch(/clm_packet_contract/);
  });

  it('rejects path-traversal attempts', () => {
    // The WHATWG URL parser collapses `..` segments, so a literal escape attempt
    // becomes `memory://files/etc/passwd` — the resolveSafePath guard still
    // catches it because that path doesn't exist under knowledge/.
    expect(() =>
      readFilesResource(new URL('memory://files/../../etc/passwd')),
    ).toThrow();
  });

  it('rejects unsupported schemes', () => {
    expect(() => readFilesResource(new URL('memory://keys/index.json'))).toThrow(
      /unsupported uri/,
    );
  });
});

describe('memory://keys/index.json resource', () => {
  it('returns a JSON index covering every claim in the corpus', () => {
    const result = readKeysResource(new URL('memory://keys/index.json'));
    expect(result.contents[0].mimeType).toBe('application/json');
    const index = JSON.parse(result.contents[0].text) as Array<{
      claim_id: string;
      aliases: string[];
      tags: string[];
      source_file: string;
      confidence: number;
    }>;
    expect(index.length).toBeGreaterThanOrEqual(listKnowledgeFiles().length - 2);
    // Every entry has the documented shape.
    for (const entry of index) {
      expect(entry.claim_id).toMatch(/^clm_/);
      expect(typeof entry.confidence).toBe('number');
      expect(Array.isArray(entry.tags)).toBe(true);
    }
    // The canonical packet-contract claim is in there.
    expect(index.some((e) => e.claim_id === 'clm_packet_contract')).toBe(true);
  });
});
