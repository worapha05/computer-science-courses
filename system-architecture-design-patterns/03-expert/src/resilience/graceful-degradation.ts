/**
 * Graceful Degradation — when a dependency is unavailable (circuit open,
 * rate limited, timed out, or a hard error), return something useful
 * instead of a hard failure: a cached/stale value, a cheaper computed
 * default, or a reduced feature set. The goal is that the OVERALL system
 * stays usable even when a part of it is unhealthy.
 *
 * Three strategies are shown here, roughly in order of "how good" the
 * degraded response is:
 * 1. Stale-while-revalidate cache: serve the last known-good value.
 * 2. Static fallback: serve a fixed default (e.g. empty recommendations).
 * 3. Fallback chain: try a cheaper/simpler secondary provider.
 */

export interface DegradationResult<T> {
  readonly value: T;
  readonly source: 'primary' | 'cache' | 'fallback';
}

export class StaleCache<T> {
  private lastKnownGood: T | undefined;
  private lastUpdatedAt: number | undefined;

  set(value: T): void {
    this.lastKnownGood = value;
    this.lastUpdatedAt = Date.now();
  }

  get(): { value: T; ageMs: number } | undefined {
    if (this.lastKnownGood === undefined || this.lastUpdatedAt === undefined) return undefined;
    return { value: this.lastKnownGood, ageMs: Date.now() - this.lastUpdatedAt };
  }
}

/**
 * Wraps a primary async call: on success, caches the result and returns it.
 * On failure, serves the last cached value if present, otherwise falls back
 * to a static default. Never throws — callers get a best-effort answer.
 */
export async function withGracefulDegradation<T>(
  primary: () => Promise<T>,
  cache: StaleCache<T>,
  staticFallback: T,
): Promise<DegradationResult<T>> {
  try {
    const value = await primary();
    cache.set(value);
    return { value, source: 'primary' };
  } catch (err) {
    const cached = cache.get();
    if (cached) {
      console.warn(
        `Primary call failed (${(err as Error).message}); serving stale cache (age ${cached.ageMs}ms)`,
      );
      return { value: cached.value, source: 'cache' };
    }
    console.warn(
      `Primary call failed (${(err as Error).message}); no cache available, serving static fallback`,
    );
    return { value: staticFallback, source: 'fallback' };
  }
}

/** A fallback chain tries providers in order until one succeeds, e.g. primary API -> secondary API -> static default. */
export async function withFallbackChain<T>(
  providers: Array<() => Promise<T>>,
): Promise<DegradationResult<T>> {
  for (let i = 0; i < providers.length; i += 1) {
    try {
      const value = await providers[i]!();
      return { value, source: i === 0 ? 'primary' : 'fallback' };
    } catch {
      continue;
    }
  }
  throw new Error('All providers in the fallback chain failed');
}
