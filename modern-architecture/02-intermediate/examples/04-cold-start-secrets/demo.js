/**
 * Cold start simulation + Secret Manager cache
 */
import { sleep, log } from '../../lib/http.js';
import { createSecretCache, listSecretPaths } from '../../lib/secrets.js';

let processReady = false;
const secretCache = createSecretCache({ ttlMs: 30_000 });

/** จำลอง init ตอน cold: โหลด dependency ใหญ่ + ดึง secret */
async function coldInit() {
  const t0 = Date.now();
  await sleep(80); // unpack / import heavy SDK
  const { value, source } = await secretCache.get('api/payment-provider/key');
  processReady = true;
  const ms = Date.now() - t0;

  log('info', 'cold_init_done', {
    ms,
    secretSource: source,
    secretPaths: listSecretPaths().length,
  });

  return { initMs: ms, apiKeyLast4: value.slice(-4), secretSource: source };
}

async function handler(requestId) {
  const t0 = Date.now();
  let init = null;

  if (!processReady) {
    init = await coldInit();
  }

  const { value, source } = await secretCache.get('api/payment-provider/key');
  await sleep(5); // business work

  return {
    requestId,
    cold: Boolean(init),
    initMs: init?.initMs ?? 0,
    handlerMs: Date.now() - t0,
    initSecretSource: init?.secretSource ?? null,
    requestSecretSource: source,
    apiKeyLast4: value.slice(-4),
  };
}

console.log('secrets available:', listSecretPaths());
console.log('invoke #1 (cold):', await handler('r1'));
console.log('invoke #2 (warm):', await handler('r2'));
console.log('invoke #3 (warm):', await handler('r3'));

// จำลอง idle → container recycle
processReady = false;
secretCache.invalidate();
console.log('invoke #4 (cold again):', await handler('r4'));

console.log(`
เทคนิคลด cold start / ขนาดแพ็กเกจ:
  1. อย่า bundle AWS SDK ทั้งก้อนถ้า runtime มีให้แล้ว (ตาม version)
  2. ใช้ minified bundle / แยก layer สำหรับ dependency ร่วม
  3. เลี่ยงโหลด ML model ใหญ่ใน function เล็ก — พิจารณา container / GPU service
  4. Provisioned concurrency สำหรับ path ที่ latency-critical
`);
