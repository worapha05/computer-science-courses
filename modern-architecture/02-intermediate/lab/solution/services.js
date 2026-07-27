import { randomUUID } from 'node:crypto';
import { sleep, log } from '../../lib/http.js';
import { createSecretCache } from '../../lib/secrets.js';
import { restaurantsDb, ordersDb, paymentsDb, orderQueue } from './stores.js';

const secrets = createSecretCache({ ttlMs: 60_000 });

export async function listRestaurants() {
  const keys = await restaurantsDb.keys();
  const items = [];
  for (const k of keys) items.push(await restaurantsDb.get(k));
  return items;
}

export async function acceptOrder({ restaurantId, items, amount }, correlationId) {
  const restaurant = await restaurantsDb.get(restaurantId);
  if (!restaurant) {
    const err = new Error('unknown_restaurant');
    err.status = 400;
    throw err;
  }

  const order = {
    id: `fd_${randomUUID().slice(0, 8)}`,
    restaurantId,
    items,
    amount,
    status: 'accepted',
    correlationId,
    createdAt: new Date().toISOString(),
  };

  await ordersDb.set(order.id, order);
  orderQueue.push({ orderId: order.id, correlationId });

  log('info', 'order.accepted', { orderId: order.id, correlationId });
  return order;
}

export async function getOrderComposition(orderId) {
  const order = await ordersDb.get(orderId);
  if (!order) return null;

  const paymentId = await paymentsDb.get(`byOrder:${orderId}`);
  const payment = paymentId ? await paymentsDb.get(paymentId) : null;

  return { order, payment };
}

/** Async worker — แยก failure domain จาก HTTP thread ของเมนูร้าน */
export async function processOrderJob(job) {
  const order = await ordersDb.get(job.orderId);
  if (!order) return;

  order.status = 'processing';
  await ordersDb.set(order.id, order);

  const { value: apiKey, source } = await secrets.get('api/payment-provider/key');
  log('info', 'payment.secret_loaded', {
    orderId: order.id,
    source,
    keyLast4: apiKey.slice(-4),
    correlationId: job.correlationId,
  });

  try {
    await sleep(40); // call provider
    if (order.amount <= 0) throw new Error('invalid_amount');
    if (String(order.amount).endsWith('13')) throw new Error('provider_timeout');

    const payment = {
      id: `pay_${randomUUID().slice(0, 8)}`,
      orderId: order.id,
      amount: order.amount,
      status: 'captured',
      at: new Date().toISOString(),
    };
    await paymentsDb.set(payment.id, payment);
    await paymentsDb.set(`byOrder:${order.id}`, payment.id);
    order.status = 'paid';
    await ordersDb.set(order.id, order);

    log('info', 'order.paid', { orderId: order.id, correlationId: job.correlationId });
  } catch (err) {
    order.status = 'failed';
    order.error = err.message;
    await ordersDb.set(order.id, order);

    log('error', 'order.failed', {
      orderId: order.id,
      error: err.message,
      correlationId: job.correlationId,
    });
  }
}

export function startWorker() {
  setInterval(async () => {
    const job = orderQueue.shift();
    if (job) await processOrderJob(job);
  }, 50);
}
