/**
 * Sync REST chain vs Async queue — จำลอง latency และ failure blast radius
 */
import { sleep, log } from '../../lib/http.js';

const bus = [];

async function inventoryReserve(orderId) {
  await sleep(30);
  if (orderId.endsWith('OUT')) throw new Error('out_of_stock');
  return { reserved: true };
}

async function chargePayment(orderId) {
  await sleep(40);
  if (orderId.endsWith('PAYFAIL')) throw new Error('payment_declined');
  return { charged: true };
}

async function arrangeShipping(orderId) {
  await sleep(25);
  return { tracking: `TRK-${orderId}` };
}

/** Sync: ลูกค้ารอทั้ง chain — บริการกลางทางล่ม = request ล้ม */
async function syncCheckout(orderId) {
  const t0 = Date.now();
  try {
    await inventoryReserve(orderId);
    await chargePayment(orderId);
    const ship = await arrangeShipping(orderId);
    return { ok: true, mode: 'sync', tracking: ship.tracking, clientMs: Date.now() - t0 };
  } catch (err) {
    return { ok: false, mode: 'sync', error: err.message, clientMs: Date.now() - t0 };
  }
}

/** Async: API รับงานแล้วตอบ 202 — worker ประมวลผลต่อ */
async function asyncAccept(orderId) {
  const t0 = Date.now();
  bus.push({ type: 'OrderAccepted', orderId, at: Date.now() });
  log('info', 'accepted', { orderId });
  return { ok: true, mode: 'async', status: 'accepted', clientMs: Date.now() - t0 };
}

async function asyncWorkersDrain() {
  const results = [];
  while (bus.length) {
    const msg = bus.shift();
    const t0 = Date.now();
    try {
      await inventoryReserve(msg.orderId);
      await chargePayment(msg.orderId);
      const ship = await arrangeShipping(msg.orderId);
      results.push({
        orderId: msg.orderId,
        ok: true,
        tracking: ship.tracking,
        workerMs: Date.now() - t0,
      });
    } catch (err) {
      results.push({
        orderId: msg.orderId,
        ok: false,
        error: err.message,
        workerMs: Date.now() - t0,
      });
    }
  }
  return results;
}

console.log('=== SYNC ===');
console.log(await syncCheckout('ORD-1001'));
console.log(await syncCheckout('ORD-PAYFAIL'));

console.log('\n=== ASYNC ===');
console.log(await asyncAccept('ORD-2001'));
console.log(await asyncAccept('ORD-OUT'));
console.log('workers:', await asyncWorkersDrain());

console.log(`
สังเกต: async ทำให้ clientMs ต่ำมาก แต่ความสำเร็จของธุรกิจมาทีหลัง
ต้องมีสถานะออเดอร์ + แจ้งเตือนลูกค้า + DLQ เมื่อ worker ล้ม
`);
