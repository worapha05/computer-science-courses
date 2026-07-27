/**
 * Resilience primitives สำหรับ lab / production-inspired demos
 */
import { sleep } from '../../lib/http.js';

export function withTimeout(promise, ms, label = 'operation') {
  let timer;

  const timeout = new Promise((_, reject) => {
    timer = setTimeout(
      () => reject(Object.assign(new Error(`timeout:${label}`), { code: 'TIMEOUT' })),
      ms,
    );
  });

  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

export async function retry(
  fn,
  {
    retries = 3,
    baseMs = 50,
    maxMs = 1000,
    jitter = true,
    retryOn = (err) => err.code === 'TIMEOUT' || err.code === 'UNAVAILABLE',
  } = {},
) {
  let lastErr;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn(attempt);
    } catch (err) {
      lastErr = err;
      if (attempt === retries || !retryOn(err)) throw err;

      const exp = Math.min(maxMs, baseMs * 2 ** attempt);
      const delay = jitter ? Math.floor(Math.random() * exp) : exp;
      await sleep(delay);
    }
  }
  throw lastErr;
}

export function createCircuitBreaker({
  failureThreshold = 3,
  cooldownMs = 400,
  halfOpenMax = 1,
} = {}) {
  let state = 'closed';
  let failures = 0;
  let openedAt = 0;
  let halfOpenInFlight = 0;

  return {
    getState: () => state,

    async exec(fn) {
      const now = Date.now();

      if (state === 'open') {
        if (now - openedAt < cooldownMs) {
          throw Object.assign(new Error('circuit_open'), { code: 'CIRCUIT_OPEN' });
        }
        state = 'half-open';
        halfOpenInFlight = 0;
      }

      if (state === 'half-open' && halfOpenInFlight >= halfOpenMax) {
        throw Object.assign(new Error('circuit_open'), { code: 'CIRCUIT_OPEN' });
      }
      if (state === 'half-open') halfOpenInFlight += 1;

      try {
        const result = await fn();
        state = 'closed';
        failures = 0;
        halfOpenInFlight = 0;
        return result;
      } catch (err) {
        failures += 1;
        if (state === 'half-open' || failures >= failureThreshold) {
          state = 'open';
          openedAt = Date.now();
          failures = 0;
        }
        throw err;
      }
    },
  };
}

export function createRateLimiter({ capacity = 5, refillPerSec = 5 } = {}) {
  let tokens = capacity;
  let last = Date.now();

  return {
    tryRemove(n = 1) {
      const now = Date.now();
      const elapsed = (now - last) / 1000;
      tokens = Math.min(capacity, tokens + elapsed * refillPerSec);
      last = now;

      if (tokens >= n) {
        tokens -= n;
        return true;
      }
      return false;
    },
  };
}

/** Graceful degradation helper */
export async function withFallback(primaryFn, fallbackFn) {
  try {
    return { source: 'primary', data: await primaryFn() };
  } catch {
    return { source: 'fallback', data: await fallbackFn() };
  }
}
