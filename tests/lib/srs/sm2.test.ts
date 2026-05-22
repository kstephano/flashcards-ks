import { describe, it, expect } from 'vitest';
import { applySm2 } from '@/lib/srs/sm2';

const DEFAULT: Parameters<typeof applySm2>[0] = {
  easeFactor: 2.5,
  intervalDays: 0,
  repetitions: 0,
};

describe('applySm2', () => {
  it('first correct response sets interval to 1 day', () => {
    const result = applySm2(DEFAULT, 4);
    expect(result.intervalDays).toBe(1);
    expect(result.repetitions).toBe(1);
  });

  it('second correct response sets interval to 6 days', () => {
    const after1 = applySm2(DEFAULT, 4);
    const after2 = applySm2(after1, 4);
    expect(after2.intervalDays).toBe(6);
    expect(after2.repetitions).toBe(2);
  });

  it('third correct response multiplies interval by ease factor', () => {
    const s1 = applySm2(DEFAULT, 5);
    const s2 = applySm2(s1, 5);
    const s3 = applySm2(s2, 5);
    expect(s3.intervalDays).toBe(Math.round(6 * s2.easeFactor));
    expect(s3.repetitions).toBe(3);
  });

  it('incorrect response (quality 0) resets repetitions to 0 and interval to 1', () => {
    const after3 = applySm2(applySm2(applySm2(DEFAULT, 4), 4), 4);
    const reset = applySm2(after3, 0);
    expect(reset.repetitions).toBe(0);
    expect(reset.intervalDays).toBe(1);
  });

  it('incorrect response (quality 2) also resets', () => {
    const after2 = applySm2(applySm2(DEFAULT, 5), 5);
    const reset = applySm2(after2, 2);
    expect(reset.repetitions).toBe(0);
    expect(reset.intervalDays).toBe(1);
  });

  it('quality 3 (borderline correct) advances repetitions', () => {
    const result = applySm2(DEFAULT, 3);
    expect(result.repetitions).toBe(1);
    expect(result.intervalDays).toBe(1);
  });

  it('ease factor floor is 1.3', () => {
    let state = DEFAULT;
    for (let i = 0; i < 20; i++) state = applySm2(state, 0);
    expect(state.easeFactor).toBeCloseTo(1.3, 5);
  });

  it('ease factor increases with perfect quality', () => {
    const result = applySm2(DEFAULT, 5);
    expect(result.easeFactor).toBeGreaterThan(DEFAULT.easeFactor);
  });

  it('due date is in the future for correct response', () => {
    const result = applySm2(DEFAULT, 4);
    expect(result.dueDate.getTime()).toBeGreaterThan(Date.now());
  });

  it('throws RangeError for quality < 0', () => {
    expect(() => applySm2(DEFAULT, -1)).toThrow(RangeError);
  });

  it('throws RangeError for quality > 5', () => {
    expect(() => applySm2(DEFAULT, 6)).toThrow(RangeError);
  });
});
