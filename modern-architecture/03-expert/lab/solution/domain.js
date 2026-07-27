/**
 * Domain services สำหรับ NovaMart saga lab
 */
import { sleep, log } from '../../lib/http.js';

const stock = new Map([['SKU-FLASH', 100]]);

export async function reserveInventory(orderId, qty = 1) {
  await sleep(10);
  const left = stock.get('SKU-FLASH') ?? 0;
  if (left < qty) {
    throw Object.assign(new Error('out_of_stock'), { code: 'OUT_OF_STOCK' });
  }
  stock.set('SKU-FLASH', left - qty);
  log('info', 'inventory.reserved', { orderId, left: stock.get('SKU-FLASH') });
  return { reservationId: `res-${orderId}` };
}

export async function releaseInventory(orderId, qty = 1) {
  await sleep(8);
  stock.set('SKU-FLASH', (stock.get('SKU-FLASH') ?? 0) + qty);
  log('warn', 'inventory.released', { orderId, left: stock.get('SKU-FLASH') });
}

/**
 * paymentRaw — ไม่มี resilience (ให้ adapter ห่อ)
 * orderId ที่รวม PAYFAIL / SLOW / FLAP จะจำลองพฤติกรรมต่างกัน
 */
export async function paymentRaw(orderId, amount) {
  if (orderId.includes('SLOW')) {
    await sleep(250);
    return { chargeId: `ch-${orderId}` };
  }

  if (orderId.includes('FLAP')) {
    await sleep(20);
    if (!paymentRaw._flap) paymentRaw._flap = 0;
    paymentRaw._flap += 1;
    if (paymentRaw._flap % 2 === 1) {
      throw Object.assign(new Error('unavailable'), { code: 'UNAVAILABLE' });
    }
    return { chargeId: `ch-${orderId}` };
  }

  await sleep(20);
  if (orderId.includes('PAYFAIL') || amount > 1_000_000) {
    throw Object.assign(new Error('declined'), { code: 'DECLINED' });
  }
  return { chargeId: `ch-${orderId}` };
}

export async function refundPayment(orderId) {
  await sleep(10);
  log('warn', 'payment.refunded', { orderId });
}

export async function arrangeShipping(orderId) {
  await sleep(12);
  if (orderId.includes('SHIPFAIL')) {
    throw Object.assign(new Error('carrier_down'), { code: 'SHIP_FAIL' });
  }
  return { tracking: `TRK-${orderId}` };
}

export async function cancelShipping(orderId) {
  await sleep(8);
  log('warn', 'shipping.cancelled', { orderId });
}

export function stockLeft() {
  return stock.get('SKU-FLASH');
}
