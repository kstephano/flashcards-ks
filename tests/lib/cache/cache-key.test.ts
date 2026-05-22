import { describe, it, expect } from 'vitest';
import { buildCacheKey } from '@/lib/cache/generation-cache';

describe('buildCacheKey', () => {
  it('is deterministic for the same inputs', () => {
    const params = {
      pdfHash: 'abc123',
      examName: 'USMLE Step 1',
      requestedCardCount: 100,
      maxWebSearches: 3,
    };
    expect(buildCacheKey(params)).toBe(buildCacheKey(params));
  });

  it('differs when exam name changes', () => {
    const base = {
      pdfHash: 'abc123',
      examName: 'USMLE Step 1',
      requestedCardCount: 100,
      maxWebSearches: 3,
    };
    expect(buildCacheKey(base)).not.toBe(
      buildCacheKey({ ...base, examName: 'MCAT' }),
    );
  });

  it('differs when pdf hash changes', () => {
    const base = {
      pdfHash: 'abc123',
      examName: null,
      requestedCardCount: null,
      maxWebSearches: 0,
    };
    expect(buildCacheKey(base)).not.toBe(
      buildCacheKey({ ...base, pdfHash: 'def456' }),
    );
  });

  it('handles null examName without throwing', () => {
    const key = buildCacheKey({
      pdfHash: 'abc123',
      examName: null,
      requestedCardCount: null,
      maxWebSearches: 0,
    });
    expect(key).toHaveLength(64);
  });

  it('differs when maxWebSearches changes', () => {
    const base = { pdfHash: 'abc', examName: null, requestedCardCount: null, maxWebSearches: 3 };
    expect(buildCacheKey(base)).not.toBe(buildCacheKey({ ...base, maxWebSearches: 5 }));
  });
});
