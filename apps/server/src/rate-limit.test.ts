import { describe, expect, it } from 'vitest';
import { RateLimiter } from './rate-limit.js';

describe('RateLimiter', () => {
  it('allows max attempts per window per key, then refuses until the window slides', () => {
    let now = 0;
    const limiter = new RateLimiter(3, 1000, () => now);
    expect([1, 2, 3, 4].map(() => limiter.take('a'))).toEqual([true, true, true, false]);
    expect(limiter.take('b')).toBe(true);
    now = 999;
    expect(limiter.take('a')).toBe(false);
    now = 1001;
    expect(limiter.take('a')).toBe(true);
  });

  it('does not count refused attempts', () => {
    let now = 0;
    const limiter = new RateLimiter(1, 1000, () => now);
    limiter.take('a');
    now = 500;
    limiter.take('a');
    now = 1001;
    expect(limiter.take('a')).toBe(true);
  });

  it('prunes keys whose window has passed', () => {
    let now = 0;
    const limiter = new RateLimiter(1, 1000, () => now);
    limiter.take('a');
    now = 2000;
    limiter.prune();
    expect((limiter as unknown as { hits: Map<string, number[]> }).hits.size).toBe(0);
  });
});
