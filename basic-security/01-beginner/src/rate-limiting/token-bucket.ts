export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs?: number;
}

export class TokenBucket {
  private tokens: number;
  private lastRefillMs: number;

  constructor(
    private readonly capacity: number,
    private readonly refillPerSecond: number,
  ) {
    this.tokens = capacity;
    this.lastRefillMs = Date.now();
  }

  private refill(now: number): void {
    const elapsedSec = (now - this.lastRefillMs) / 1000;
    const add = elapsedSec * this.refillPerSecond;
    this.tokens = Math.min(this.capacity, this.tokens + add);
    this.lastRefillMs = now;
  }

  public tryConsume(cost = 1): RateLimitResult {
    const now = Date.now();
    this.refill(now);

    if (this.tokens >= cost) {
      this.tokens -= cost;
      return { allowed: true, remaining: Math.floor(this.tokens) };
    }

    const deficit = cost - this.tokens;
    const retryAfterMs = Math.ceil((deficit / this.refillPerSecond) * 1000);
    return { allowed: false, remaining: 0, retryAfterMs };
  }
}

export class KeyedRateLimiter {
  private readonly buckets = new Map<string, TokenBucket>();

  constructor(
    private readonly capacity: number,
    private readonly refillPerSecond: number,
  ) {}

  public check(key: string): RateLimitResult {
    let bucket = this.buckets.get(key);
    if (!bucket) {
      bucket = new TokenBucket(this.capacity, this.refillPerSecond);
      this.buckets.set(key, bucket);
    }
    return bucket.tryConsume(1);
  }
}

export function demoRateLimiting(): void {
  console.log('\n=== Rate Limiting (Availability) Demo ===\n');

  const loginLimiter = new KeyedRateLimiter(5, 1);
  const attackerIp = '203.0.113.99';

  for (let i = 1; i <= 8; i++) {
    const result = loginLimiter.check(attackerIp);
    if (result.allowed) {
      console.log(`attempt ${i}: ALLOW remaining=${result.remaining}`);
    } else {
      console.log(
        `attempt ${i}: BLOCK retryAfter≈${result.retryAfterMs}ms (ป้องกัน brute-force / DoS)`,
      );
    }
  }
}
