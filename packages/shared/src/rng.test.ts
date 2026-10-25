import { describe, expect, it } from 'vitest';
import { createRng } from './rng.js';

describe('createRng', () => {
  it('is deterministic for a given seed', () => {
    const a = createRng(42);
    const b = createRng(42);
    const seqA = Array.from({ length: 5 }, () => a.next());
    const seqB = Array.from({ length: 5 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it('differs across seeds', () => {
    expect(createRng(1).next()).not.toEqual(createRng(2).next());
  });

  it('int stays in range', () => {
    const rng = createRng(7);
    for (let i = 0; i < 1000; i++) {
      const n = rng.int(6);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(6);
    }
  });
});
