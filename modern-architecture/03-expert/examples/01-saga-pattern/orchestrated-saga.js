/**
 * Orchestrated Saga — orchestrator สั่งทีละขั้นและ compensate ย้อนกลับ
 */
import {
  reserveInventory,
  releaseInventory,
  chargePayment,
  refundPayment,
  arrangeShipping,
  cancelShipping,
  snapshot,
} from './services.js';
import { log } from '../../lib/http.js';

async function runSaga(order) {
  const done = [];

  try {
    await reserveInventory(order.id, order.sku, order.qty);
    done.push('inventory');

    await chargePayment(order.id, order.amount);
    done.push('payment');

    await arrangeShipping(order.id);
    done.push('shipping');

    log('info', 'saga.completed', { orderId: order.id });
    return { ok: true, orderId: order.id };
  } catch (err) {
    log('error', 'saga.failed', { orderId: order.id, error: err.message, done });

    if (done.includes('shipping')) await cancelShipping(order.id);
    if (done.includes('payment')) await refundPayment(order.id);
    if (done.includes('inventory')) await releaseInventory(order.id, order.sku, order.qty);

    return { ok: false, orderId: order.id, error: err.message, compensated: done };
  }
}

console.log('=== success ===');
console.log(await runSaga({ id: 'ORD-OK', sku: 'SKU-1', qty: 1, amount: 900 }));

console.log('\n=== pay fail → compensate inventory ===');
console.log(await runSaga({ id: 'ORD-PAY', sku: 'SKU-1', qty: 1, amount: 9000 }));

console.log('\n=== ship fail → compensate pay+inventory ===');
console.log(await runSaga({ id: 'ORD-NOSHIP', sku: 'SKU-1', qty: 1, amount: 500 }));

console.log('\nstate:', snapshot());
