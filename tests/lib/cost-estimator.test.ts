import { describe, it, expect } from 'vitest';
import { estimateCost } from '@/lib/cost-estimator';

describe('estimateCost', () => {
  it('totalHigh is always greater than totalLow', () => {
    const result = estimateCost({
      pageCount: 50,
      sectionCount: 5,
      requestedCardCount: 100,
      maxWebSearches: 3,
    });
    expect(result.totalHigh).toBeGreaterThan(result.totalLow);
  });

  it('defaults to 20 cards per section when requestedCardCount is null', () => {
    const withNull = estimateCost({
      pageCount: 10,
      sectionCount: 2,
      requestedCardCount: null,
      maxWebSearches: 0,
    });
    const withExplicit = estimateCost({
      pageCount: 10,
      sectionCount: 2,
      requestedCardCount: 40,
      maxWebSearches: 0,
    });
    expect(withNull.totalLow).toBeCloseTo(withExplicit.totalLow, 4);
    expect(withNull.totalHigh).toBeCloseTo(withExplicit.totalHigh, 4);
  });

  it('zero web searches produces zero searchCost', () => {
    const result = estimateCost({
      pageCount: 10,
      sectionCount: 2,
      requestedCardCount: 40,
      maxWebSearches: 0,
    });
    expect(result.searchCost).toBe(0);
  });

  it('search cost equals maxWebSearches * $0.01', () => {
    const result = estimateCost({
      pageCount: 10,
      sectionCount: 2,
      requestedCardCount: 40,
      maxWebSearches: 5,
    });
    expect(result.searchCost).toBeCloseTo(0.05, 6);
  });

  it('all cost values are positive numbers', () => {
    const result = estimateCost({
      pageCount: 20,
      sectionCount: 3,
      requestedCardCount: 60,
      maxWebSearches: 2,
    });
    expect(result.sonnetLow).toBeGreaterThan(0);
    expect(result.opusLow).toBeGreaterThan(0);
    expect(result.totalLow).toBeGreaterThan(0);
  });

  it('more pages increases cost proportionally', () => {
    const small = estimateCost({ pageCount: 10, sectionCount: 2, requestedCardCount: 40, maxWebSearches: 0 });
    const large = estimateCost({ pageCount: 100, sectionCount: 2, requestedCardCount: 40, maxWebSearches: 0 });
    expect(large.totalLow).toBeGreaterThan(small.totalLow);
  });
});
