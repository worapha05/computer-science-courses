/**
 * Resilience demo — combines Rate Limiter -> Bulkhead -> Circuit Breaker ->
 * Graceful Degradation into one call pipeline against a flaky dependency
 * that simulates an outage for a few calls before recovering.
 *
 * Recommended order of the pipeline (outside-in):
 * 1. Rate Limiter — cheapest check, reject overload before doing any work.
 * 2. Bulkhead   — reserve/limit concurrency for this dependency only.
 * 3. Circuit Breaker — skip the call entirely if the dependency is known-bad.
 * 4. (the real call)
 * 5. Graceful Degradation wraps the whole thing so callers always get a
 *  usable response even when 1-4 result in an error.
 *
 * Run: npx tsx resilience/index.ts
 */
import { Bulkhead, BulkheadRejectedError } from './bulkhead.js';
import { CircuitBreaker, CircuitOpenError } from './circuit-breaker.js';
import { StaleCache, withGracefulDegradation } from './graceful-degradation.js';
import { RateLimitExceededError, TokenBucketRateLimiter } from './rate-limiter.js';

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class FlakyRecommendationService {
  private callCount = 0;

  async fetchRecommendations(): Promise<string[]> {
    this.callCount += 1;
    await delay(5);
    // Simulate an outage window: calls #3 through #5 fail, then it recovers.
    if (this.callCount >= 3 && this.callCount <= 5) {
      throw new Error(`recommendation-service unavailable (call #${this.callCount})`);
    }
    return [`item-${this.callCount}-A`, `item-${this.callCount}-B`];
  }
}

async function pipelineDemo(): Promise<void> {
  console.log('=== Demo 1: Rate Limiter + Bulkhead + Circuit Breaker + Graceful Degradation ===\n');

  const service = new FlakyRecommendationService();
  const rateLimiter = new TokenBucketRateLimiter({
    name: 'recs-api',
    capacity: 20,
    refillPerSecond: 50,
  });
  const bulkhead = new Bulkhead({ name: 'recs-api', maxConcurrent: 3, maxQueueSize: 5 });
  const circuitBreaker = new CircuitBreaker({
    name: 'recs-api',
    failureThreshold: 2,
    resetTimeoutMs: 150,
    halfOpenSuccessThreshold: 2,
  });
  const cache = new StaleCache<string[]>();
  const staticFallback: string[] = ['default-bestseller-1', 'default-bestseller-2'];

  const protectedCall = async (): Promise<string[]> => {
    rateLimiter.acquireOrThrow();
    return bulkhead.execute(() => circuitBreaker.execute(() => service.fetchRecommendations()));
  };

  for (let i = 1; i <= 16; i += 1) {
    const result = await withGracefulDegradation(protectedCall, cache, staticFallback);
    console.log(
      `call #${String(i).padStart(2, '0')} | circuit=${circuitBreaker.getState().padEnd(9)} | source=${result.source.padEnd(8)} | data=${JSON.stringify(result.value)}`,
    );
    await delay(60); // spaced out so resetTimeoutMs (150ms) has a chance to elapse mid-demo
  }
}

async function bulkheadIsolationDemo(): Promise<void> {
  console.log(
    '\n=== Demo 2: Bulkhead rejects excess concurrent load instead of queueing forever ===\n',
  );

  const bulkhead = new Bulkhead({ name: 'search-api', maxConcurrent: 2, maxQueueSize: 2 });
  const slowCall = async (id: number): Promise<number> => {
    await delay(100);
    return id;
  };

  const attempts = Array.from({ length: 6 }, (_, i) => i + 1);
  const outcomes = await Promise.allSettled(
    attempts.map((id) => bulkhead.execute(() => slowCall(id))),
  );

  outcomes.forEach((outcome, index) => {
    if (outcome.status === 'fulfilled') {
      console.log(` request #${attempts[index]} completed (result=${outcome.value})`);
    } else if (outcome.reason instanceof BulkheadRejectedError) {
      console.log(
        ` request #${attempts[index]} REJECTED — bulkhead full (2 active + 2 queued already)`,
      );
    } else {
      console.log(` request #${attempts[index]} failed:`, outcome.reason);
    }
  });
}

async function rateLimiterBurstDemo(): Promise<void> {
  console.log('\n=== Demo 3: Rate limiter allows a burst up to capacity, then throttles ===\n');

  const limiter = new TokenBucketRateLimiter({
    name: 'public-api',
    capacity: 5,
    refillPerSecond: 5,
  });

  for (let i = 1; i <= 8; i += 1) {
    try {
      limiter.acquireOrThrow();
      console.log(` request #${i}: allowed (tokens left ~${limiter.availableTokens().toFixed(1)})`);
    } catch (err) {
      if (err instanceof RateLimitExceededError) {
        console.log(` request #${i}: THROTTLED (429)`);
      } else {
        throw err;
      }
    }
  }
}

async function main(): Promise<void> {
  await pipelineDemo();
  await bulkheadIsolationDemo();
  await rateLimiterBurstDemo();

  console.log('\n=== Custom error types available for callers to branch on ===');
  console.log(
    ` ${new CircuitOpenError('example').name}, ${new BulkheadRejectedError('example').name}, ${new RateLimitExceededError('example').name}`,
  );
}

const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  main().catch((err) => {
    console.error('Fatal error in demo:', err);
    process.exitCode = 1;
  });
}
