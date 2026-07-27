/**
 * Database-per-service + polyglot-style stores + API composition
 */
import { createMemoryStore, log } from '../../lib/http.js';

// แต่ละบริการมี store ของตัวเอง — ห้าม join ข้าม
const ordersDb = createMemoryStore();
const paymentsDb = createMemoryStore();

export async function createOrder({ orderId, customerId, amount }) {
  const order = {
    id: orderId,
    customerId,
    amount,
    status: 'pending_payment',
    createdAt: new Date().toISOString(),
  };
  await ordersDb.set(orderId, order);
  log('info', 'orders.created', { orderId });
  return order;
}

export async function recordPayment({ paymentId, orderId, amount, status }) {
  const payment = {
    id: paymentId,
    orderId,
    amount,
    status,
    at: new Date().toISOString(),
  };
  await paymentsDb.set(paymentId, payment);
  await paymentsDb.set(`byOrder:${orderId}`, paymentId);
  log('info', 'payments.recorded', { paymentId, orderId, status });
  return payment;
}

export async function markOrderPaid(orderId) {
  const order = await ordersDb.get(orderId);
  if (!order) throw new Error('order_not_found');
  order.status = 'paid';
  await ordersDb.set(orderId, order);
  return order;
}

/** Anti-pattern ที่ห้าม: shared query ข้าม DB */
export async function forbiddenJoin(orderId) {
  throw new Error(
    `FORBIDDEN: cannot JOIN orders_db with payments_db for ${orderId}. Use composition or events.`,
  );
}

/** BFF / API Composition — รวมผลจากสองบริการ */
export async function composeOrderView(orderId) {
  const order = await ordersDb.get(orderId);
  if (!order) return null;

  const paymentId = await paymentsDb.get(`byOrder:${orderId}`);
  const payment = paymentId ? await paymentsDb.get(paymentId) : null;

  return {
    order,
    payment,
    consistency: 'read-time composition (may be briefly stale in real systems)',
  };
}

// --- demo ---
await createOrder({ orderId: 'ORD-9', customerId: 'C-1', amount: 1500 });
await recordPayment({
  paymentId: 'PAY-9',
  orderId: 'ORD-9',
  amount: 1500,
  status: 'captured',
});
await markOrderPaid('ORD-9');

console.log(JSON.stringify(await composeOrderView('ORD-9'), null, 2));

try {
  await forbiddenJoin('ORD-9');
} catch (e) {
  console.log('\n', e.message);
}

console.log(`
Polyglot ตัวอย่างในโลกจริง:
  - Orders → PostgreSQL (relational)
  - Payments → PostgreSQL คนละ instance / หรือ ledger DB
  - Session / cart → Redis
  - Search → OpenSearch
แต่ละทีมเลือก DB ตาม access pattern — ไม่แชร์ connection string ข้ามบริการ
`);
