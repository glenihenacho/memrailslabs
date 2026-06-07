import { describe, it, expect } from 'vitest';
import { tokenize, normalize, contentHash } from '@/lib/text/normalize';

describe('tokenize()', () => {
  it('lowercases and strips punctuation', () => {
    expect(tokenize('Hello, World!')).toEqual(['hello', 'world']);
  });

  it('removes stopwords and single-char tokens', () => {
    expect(tokenize('what is the packet contract?')).toEqual(['packet', 'contract']);
  });

  it('preserves underscores and hyphens', () => {
    expect(tokenize('memory_query and memory-write')).toEqual(['memory_query', 'memory-write']);
  });
});

describe('normalize()', () => {
  it('produces a stable, order-insensitive representation', () => {
    expect(normalize('packet contract')).toBe(normalize('contract packet'));
  });

  it('collapses case', () => {
    expect(normalize('Packet Contract')).toBe(normalize('packet contract'));
  });

  it('collapses common suffixes', () => {
    // singular vs plural should collapse via the stemmer
    expect(normalize('packets')).toBe(normalize('packet'));
    // -ing should drop
    expect(normalize('compressing memory')).toBe(normalize('compress memory'));
  });

  it('is empty for stopword-only queries', () => {
    expect(normalize('what is the')).toBe('');
  });
});

describe('contentHash()', () => {
  it('is deterministic', () => {
    expect(contentHash('packet contract')).toBe(contentHash('packet contract'));
  });

  it('differs across distinct inputs', () => {
    expect(contentHash('packet')).not.toBe(contentHash('contract'));
  });

  it('produces a 16-char hex string', () => {
    expect(contentHash('packet contract')).toMatch(/^[0-9a-f]{16}$/);
  });
});
