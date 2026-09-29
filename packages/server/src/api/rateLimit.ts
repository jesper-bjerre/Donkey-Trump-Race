import { createHash } from 'node:crypto';

export interface RateLimitDecision {
  allowed: boolean;
  /** Whole seconds until the window resets (for Retry-After). */
  retryAfterSeconds: number;
}

/** Minimal per-key fixed-window limiter for room bootstrap endpoints. */
export class FixedWindowRateLimiter {
  private readonly windows = new Map<string, { start: number; count: number }>();

  constructor(
    readonly limit: number,
    readonly windowMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  /** Records a hit; returns false when the key is over its limit. */
  hit(key: string): boolean {
    return this.check(key).allowed;
  }

  check(key: string): RateLimitDecision {
    const now = this.now();
    const window = this.windows.get(key);
    if (!window || now - window.start >= this.windowMs) {
      this.windows.set(key, { start: now, count: 1 });
      if (this.windows.size > 10_000) this.prune(now);
      return { allowed: true, retryAfterSeconds: 0 };
    }
    window.count++;
    const retryAfterSeconds = Math.max(1, Math.ceil((window.start + this.windowMs - now) / 1000));
    return { allowed: window.count <= this.limit, retryAfterSeconds };
  }

  private prune(now: number): void {
    for (const [key, window] of this.windows) {
      if (now - window.start >= this.windowMs) this.windows.delete(key);
    }
  }
}

export type RestRatePolicy = 'rooms.create' | 'rooms.join' | 'rooms.start' | 'privacy.request';

export const DEFAULT_REST_POLICIES: Record<RestRatePolicy, { limit: number; windowMs: number }> = {
  'rooms.create': { limit: 10, windowMs: 60_000 },
  'rooms.join': { limit: 30, windowMs: 60_000 },
  'rooms.start': { limit: 20, windowMs: 60_000 },
  'privacy.request': { limit: 5, windowMs: 60 * 60_000 },
};

/**
 * Client key for rate limiting: the (proxy-resolved) IP plus a short hash of the
 * user agent, so several players behind one NAT are not throttled as a single client.
 * The raw user agent is never stored.
 */
export function rateLimitKey(ip: string, userAgent: string | undefined): string {
  const ua = createHash('sha256')
    .update(userAgent ?? '')
    .digest('hex')
    .slice(0, 8);
  return `${ip}|${ua}`;
}

export class RestRateLimiter {
  private readonly limiters: Record<RestRatePolicy, FixedWindowRateLimiter>;

  constructor(
    overrides: Partial<Record<RestRatePolicy, { limit: number; windowMs: number }>> = {},
    now: () => number = Date.now,
    scale = 1,
  ) {
    const policies = { ...DEFAULT_REST_POLICIES, ...overrides };
    this.limiters = Object.fromEntries(
      Object.entries(policies).map(([name, p]) => [
        name,
        new FixedWindowRateLimiter(Math.round(p.limit * scale), p.windowMs, now),
      ]),
    ) as Record<RestRatePolicy, FixedWindowRateLimiter>;
  }

  check(policy: RestRatePolicy, key: string): RateLimitDecision {
    return this.limiters[policy].check(key);
  }
}

/**
 * Token bucket for one WebSocket. `take()` returns false when the bucket is empty.
 * Inputs arrive at 30 Hz; a 40/s refill with a burst of 20 absorbs network jitter while
 * a sustained 60 Hz stream is throttled.
 */
export class TokenBucket {
  private tokens: number;
  private last: number;

  constructor(
    private readonly ratePerSecond: number,
    private readonly burst: number,
    private readonly now: () => number = Date.now,
  ) {
    this.tokens = burst;
    this.last = now();
  }

  take(): boolean {
    const now = this.now();
    this.tokens = Math.min(
      this.burst,
      this.tokens + ((now - this.last) / 1000) * this.ratePerSecond,
    );
    this.last = now;
    if (this.tokens < 1) return false;
    this.tokens -= 1;
    return true;
  }
}
