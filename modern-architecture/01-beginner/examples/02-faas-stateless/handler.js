/**
 * Stateless vs Stateful anti-pattern ใน FaaS
 * รันซ้ำหลายครั้งเพื่อดูว่า global counter "ดูเหมือนทำงาน" แต่ผิดในระบบจริง
 */
import { createMemoryStore, makeHttpEvent, log } from '../../lib/http.js';

// ❌ Anti-pattern: state ใน process — หายเมื่อ cold start / คนละ instance
let unsafeCounter = 0;

export async function unsafeHandler() {
  unsafeCounter += 1;

  return {
    statusCode: 200,
    body: JSON.stringify({
      pattern: 'unsafe-global',
      count: unsafeCounter,
      warning: 'ค่านี้ไม่ใช่ source of truth — instance อื่นไม่เห็น',
    }),
  };
}

// ✅ Stateless: state อยู่ใน store ภายนอก (จำลอง DB)
const db = createMemoryStore();

export async function safeHandler(event) {
  const key = 'metrics:hello:count';
  const current = (await db.get(key)) ?? 0;
  const next = current + 1;
  await db.set(key, next);

  log('info', 'incremented', {
    key,
    next,
    requestId: event.requestContext?.requestId,
  });

  return {
    statusCode: 200,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ pattern: 'stateless-external-store', count: next }),
  };
}

// --- local demo ---
const event = makeHttpEvent({ method: 'POST', path: '/hello' });

console.log('--- unsafe (3 invokes บน process เดียวกัน) ---');
for (let i = 0; i < 3; i++) {
  console.log(await unsafeHandler(event));
}

console.log('\n--- safe (3 invokes) ---');
for (let i = 0; i < 3; i++) {
  console.log(await safeHandler(event));
}

console.log(`
ใน production: แต่ละ Lambda instance มี memory คนละก้อน
unsafeCounter จะต่างกันทุก instance และรีเซ็ตหลัง idle (cold start)
`);
