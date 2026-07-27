/**
 * Shared local transactions สำหรับ demo Saga
 */
import { sleep, log } from '../../lib/http.js';

const stock = new Map([
  ['SKU-1', 5],
  ['SKU-2', 0],
]);
const charges = new Map();
const shipments = new Map();

export async function reserveInventory(orderId, sku, qty) {
  await sleep(15);
  const available = stock.get(sku) ?? 0;
  if (available < qty) {
    throw Object.assign(new Error('out_of_stock'), { code: 'OUT_OF_STOCK' });
  }
  stock.set(sku, available - qty);
  log('info', 'inventory.reserved', { orderId, sku, qty, left: stock.get(sku) });
  return { reservationId: `res-${orderId}` };
}

export async function releaseInventory(orderId, sku, qty) {
  await sleep(10);
  stock.set(sku, (stock.get(sku) ?? 0) + qty);
  log('warn', 'inventory.released', { orderId, sku, qty, left: stock.get(sku) });
}

export async function chargePayment(orderId, amount) {
  await sleep(20);
  if (amount > 5000) {
    throw Object.assign(new Error('limit_exceeded'), { code: 'PAY_FAIL' });
  }
  charges.set(orderId, { amount, status: 'captured' });
  log('info', 'payment.captured', { orderId, amount });
  return { chargeId: `ch-${orderId}` };
}

export async function refundPayment(orderId) {
  await sleep(12);
  const c = charges.get(orderId);
  if (c) c.status = 'refunded';
  log('warn', 'payment.refunded', { orderId });
}

export async function arrangeShipping(orderId) {
  await sleep(18);
  if (orderId.includes('NOSHIP')) {
    throw Object.assign(new Error('carrier_down'), { code: 'SHIP_FAIL' });
  }
  const tracking = `TRK-${orderId}`;
  shipments.set(orderId, tracking);
  log('info', 'shipping.arranged', { orderId, tracking });
  return { tracking };
}

export async function cancelShipping(orderId) {
  await sleep(8);
  shipments.delete(orderId);
  log('warn', 'shipping.cancelled', { orderId });
}

export function snapshot() {
  return {
    stock: Object.fromEntries(stock),
    charges: Object.fromEntries(charges),
    shipments: Object.fromEntries(shipments),
  };
}
