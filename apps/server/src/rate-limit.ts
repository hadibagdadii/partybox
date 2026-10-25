/** Sliding-window limiter kept in memory, one window per key (client IP hash). */
export class RateLimiter {
  private readonly hits = new Map<string, number[]>();

  constructor(
    private readonly max: number,
    private readonly windowMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  /** Records an attempt for `key`. False when the key is over its limit; refused attempts don't count. */
  take(key: string): boolean {
    const t = this.now();
    const recent = (this.hits.get(key) ?? []).filter((at) => at > t - this.windowMs);
    const allowed = recent.length < this.max;
    if (allowed) recent.push(t);
    this.hits.set(key, recent);
    return allowed;
  }

  /** Drops keys with no attempts left in the window, so the map stays small. */
  prune(): void {
    const cutoff = this.now() - this.windowMs;
    for (const [key, times] of this.hits) {
      if (!times.some((at) => at > cutoff)) this.hits.delete(key);
    }
  }
}
