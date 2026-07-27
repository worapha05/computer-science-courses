/**
 * Distributed tracing จำลอง + structured logs
 * บน AWS ใช้ X-Ray / ADOT; บน GCP ใช้ Cloud Trace + Cloud Logging
 */
import { makeHttpEvent, sleep, log } from '../../lib/http.js';
import { createTracer, correlationFromHeaders } from '../../lib/tracing.js';

const tracer = createTracer('orders-api');

async function callPayments(parent, orderId) {
  const span = tracer.startSpan('payments.charge', parent, { 'order.id': orderId });
  try {
    await sleep(25);
    if (orderId.endsWith('X')) throw new Error('payment_error');
    span.setAttribute('payment.status', 'captured');
    return { chargeId: `ch-${orderId}` };
  } catch (err) {
    span.recordError(err);
    throw err;
  } finally {
    span.end();
  }
}

async function callInventory(parent, orderId) {
  const span = tracer.startSpan('inventory.reserve', parent, { 'order.id': orderId });
  await sleep(15);
  span.setAttribute('inventory.ok', true);
  span.end();
  return { reserved: true };
}

export async function handler(event) {
  const correlationId = correlationFromHeaders(event.headers);
  const root = tracer.startSpan('orders.checkout', null, {
    'http.method': event.requestContext?.http?.method,
    'http.path': event.rawPath,
    'correlation.id': correlationId,
  });

  log('info', 'checkout.start', {
    correlationId,
    traceId: root.span.traceId,
  });

  try {
    const body = JSON.parse(event.body || '{}');
    const orderId = body.orderId || 'ORD-1';

    await callInventory(root.span, orderId);
    const pay = await callPayments(root.span, orderId);

    root.setAttribute('order.id', orderId);
    root.end();

    log('info', 'checkout.ok', { correlationId, traceId: root.span.traceId, orderId });
    return {
      statusCode: 200,
      headers: {
        'content-type': 'application/json',
        'x-correlation-id': correlationId,
        'x-trace-id': root.span.traceId,
      },
      body: JSON.stringify({ ok: true, orderId, ...pay, correlationId }),
    };
  } catch (err) {
    root.recordError(err);
    root.end();

    log('error', 'checkout.failed', {
      correlationId,
      traceId: root.span.traceId,
      error: err.message,
    });

    return {
      statusCode: 502,
      headers: {
        'content-type': 'application/json',
        'x-correlation-id': correlationId,
        'x-trace-id': root.span.traceId,
      },
      body: JSON.stringify({ ok: false, error: err.message, correlationId }),
    };
  }
}

// --- demo ---
const ok = await handler(
  makeHttpEvent({
    method: 'POST',
    path: '/checkout',
    headers: { 'x-correlation-id': 'obs-demo-1' },
    body: { orderId: 'ORD-77' },
  }),
);
console.log('response:', ok);

const bad = await handler(
  makeHttpEvent({
    method: 'POST',
    path: '/checkout',
    headers: { 'x-correlation-id': 'obs-demo-2' },
    body: { orderId: 'ORD-X' },
  }),
);
console.log('response:', bad);

console.log('\n--- exported spans (จำลอง OTLP/X-Ray) ---');
tracer.flush();
