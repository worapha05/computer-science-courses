import { sleep } from '../../lib/http.js';
import {
  withTimeout,
  retry,
  createCircuitBreaker,
  createRateLimiter,
  withFallback,
} from './patterns.js';

let flakyFailsLeft = 2;

async function flakyUpstream() {
  await sleep(20);
  if (flakyFailsLeft > 0) {
    flakyFailsLeft -= 1;
    throw Object.assign(new Error('unavailable'), { code: 'UNAVAILABLE' });
  }
  return { ok: true };
}

async function slowUpstream() {
  await sleep(200);
  return { ok: true };
}

console.log('=== retry + backoff ===');
console.log(await retry(() => flakyUpstream(), { retries: 3, baseMs: 30 }));

console.log('\n=== timeout ===');
try {
  console.log(await withTimeout(slowUpstream(), 50, 'slowUpstream'));
} catch (e) {
  console.log(e.message);
}

console.log('\n=== circuit breaker ===');
const breaker = createCircuitBreaker({ failureThreshold: 2, cooldownMs: 150 });

async function alwaysDown() {
  throw Object.assign(new Error('down'), { code: 'UNAVAILABLE' });
}

for (let i = 0; i < 4; i++) {
  try {
    await breaker.exec(alwaysDown);
  } catch (e) {
    console.log(`call ${i + 1}:`, e.message, 'state=', breaker.getState());
  }
}

await sleep(160);

try {
  await breaker.exec(alwaysDown);
} catch (e) {
  console.log('after cooldown:', e.message, 'state=', breaker.getState());
}

console.log('\n=== rate limit ===');
const limiter = createRateLimiter({ capacity: 3, refillPerSec: 1 });
for (let i = 0; i < 5; i++) {
  console.log(`req ${i + 1}:`, limiter.tryRemove() ? 'allowed' : 'rejected');
}

console.log('\n=== graceful degradation ===');
console.log(
  await withFallback(
    async () => {
      throw new Error('reco down');
    },
    async () => ({ recommendations: ['cached-best-seller'] }),
  ),
);
