/**
 * เปรียบเทียบรูปแบบสถาปัตยกรรมด้วยการจำลอง latency / failure surface
 * ไม่ได้ต่อ network จริง — เพื่อให้เห็น trade-off ในตัวเลข
 */
import { sleep } from '../../lib/http.js';

const order = { id: 'ORD-1001', items: 3, amount: 1290 };

async function monolithCheckout(o) {
  const t0 = Date.now();
  await sleep(5); // validate
  await sleep(8); // inventory
  await sleep(10); // payment
  await sleep(6); // ship arrange

  return {
    style: 'monolith',
    orderId: o.id,
    ms: Date.now() - t0,
    deployUnit: 1,
    failureDomains: 1,
    notes: 'transaction ง่าย, deploy เสี่ยงใหญ่, ทีมชนกันใน repo',
  };
}

async function microservicesCheckout(o) {
  const t0 = Date.now();
  await sleep(12); // BFF / API
  await sleep(15); // inventory-svc
  await sleep(18); // payment-svc
  await sleep(14); // shipping-svc

  return {
    style: 'microservices',
    orderId: o.id,
    ms: Date.now() - t0,
    deployUnit: 4,
    failureDomains: 4,
    notes: 'deploy อิสระ แต่ sync chain ทำให้เป็น distributed monolith ได้',
  };
}

async function serverlessCheckout(o) {
  const t0 = Date.now();
  await sleep(8); // API Lambda (accept)
  const acceptedAt = Date.now() - t0;

  const bg = (async () => {
    await sleep(20); // inventory fn
    await sleep(25); // payment fn
    await sleep(15); // shipping fn
  })();
  await bg;

  return {
    style: 'serverless-event',
    orderId: o.id,
    clientWaitMs: acceptedAt,
    totalPipelineMs: Date.now() - t0,
    deployUnit: 'N functions',
    failureDomains: 'per-function + broker',
    notes: 'UX ตอบเร็ว, eventual consistency, ต้องคิด idempotency/retry',
  };
}

const results = [
  await monolithCheckout(order),
  await microservicesCheckout(order),
  await serverlessCheckout(order),
];

console.log(JSON.stringify({ order, results }, null, 2));
console.log(`
สรุปสั้น ๆ:
  - Monolith: latency ในเครื่องดี, ops ง่ายตอนต้น — จนทีม/domain โต
  - Microservices: คุ้มเมื่อมีทีม/scale คนละมิติ และ contract ชัด
  - Serverless: คุ้มเมื่อ burst + event-driven และยอมรับ cold start / limits
`);
