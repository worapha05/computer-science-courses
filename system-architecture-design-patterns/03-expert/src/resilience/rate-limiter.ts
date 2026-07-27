/**
 * Rate Limiter — Token Bucket algorithm.
 *
 * A bucket holds up to `capacity` tokens and refills at `refillPerSecond`
 * tokens/sec. Each call consumes one token. This allows short bursts up to
 * `capacity` while enforcing a steady-state average rate — unlike a naive
 * fixed window counter, it doesn't allow 2x the rate at window boundaries.
 *
 * Used to protect a downstream dependency (or protect yourself from a
 * noisy client) independently of the Circuit Breaker: a rate limiter caps
 * "how much traffic am I willing to send/accept", while a circuit breaker
 * reacts to "is the callee currently healthy".
 */

export class RateLimitExceededError extends Error {
  constructor(name: string) {
    super(`Rate limit exceeded for "${name}"`);
    this.name = 'RateLimitExceededError';
  }
}

export interface TokenBucketOptions {
  readonly name: string;
  readonly capacity: number;
  readonly refillPerSecond: number;
}

export class TokenBucketRateLimiter {
  private tokens: number;
  private lastRefillAt: number;

  constructor(private readonly options: TokenBucketOptions) {
    this.tokens = options.capacity;
    this.lastRefillAt = Date.now();
  }

  /** Non-blocking: returns true if a token was available and consumed, false otherwise. */
  tryAcquire(cost = 1): boolean {
    this.refill();
    if (this.tokens >= cost) {
      this.tokens -= cost;
      return true;
    }
    return false;
  }

  /** Convenience wrapper that throws instead of returning a boolean, for use in a resilience pipeline. */
  acquireOrThrow(cost = 1): void {
    if (!this.tryAcquire(cost)) {
      throw new RateLimitExceededError(this.options.name);
    }
  }

  availableTokens(): number {
    this.refill();
    return this.tokens;
  }

  private refill(): void {
    const now = Date.now();
    const elapsedSeconds = (now - this.lastRefillAt) / 1000;
    const replenished = elapsedSeconds * this.options.refillPerSecond;
    if (replenished > 0) {
      this.tokens = Math.min(this.options.capacity, this.tokens + replenished);
      this.lastRefillAt = now;
    }
  }
}
