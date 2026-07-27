/**
 * NovaMart checkout — Saga + resilience + tracing
 */
import { log } from '../../lib/http.js';
import { createTracer, newCorrelationId } from '../../lib/tracing.js';
import {
  withTimeout,
  retry,
  createCircuitBreaker,
  withFallback,
} from '../../examples/02-resilience/patterns.js';
import {
  reserveInventory,
  releaseInventory,
  paymentRaw,
  refundPayment,
  arrangeShipping,
  cancelShipping,
  stockLeft,
} from './domain.js';

const tracer = createTracer('novamart-checkout');
const paymentBreaker = createCircuitBreaker({ failureThreshold: 3, cooldownMs: 300 });

async function resilientCharge(parentSpan, orderId, amount) {
  const span = tracer.startSpan('payment.charge', parentSpan, { 'order.id': orderId });

  try {
    const result = await paymentBreaker.exec(() =>
      retry(() => withTimeout(paymentRaw(orderId, amount), 100, 'payment'), {
        retries: 2,
        baseMs: 40,
        jitter: true,
      }),
    );
    span.setAttribute('payment.status', 'captured');
    return result;
  } catch (err) {
    span.recordError(err);
    throw err;
  } finally {
    span.end();
  }
}

export async function checkoutSaga(order, correlationId = newCorrelationId()) {
  const root = tracer.startSpan('checkout', null, {
    'order.id': order.id,
    'correlation.id': correlationId,
  });
  const done = [];

  log('info', 'checkout.start', {
    correlationId,
    traceId: root.span.traceId,
    orderId: order.id,
  });

  try {
    const invSpan = tracer.startSpan('inventory.reserve', root.span);
    await reserveInventory(order.id, order.qty ?? 1);
    invSpan.end();
    done.push('inventory');

    await resilientCharge(root.span, order.id, order.amount);
    done.push('payment');

    const shipSpan = tracer.startSpan('shipping.arrange', root.span);
    await arrangeShipping(order.id);
    shipSpan.end();
    done.push('shipping');

    root.end();
    log('info', 'checkout.ok', { correlationId, traceId: root.span.traceId, orderId: order.id });
    return { ok: true, orderId: order.id, correlationId, traceId: root.span.traceId };
  } catch (err) {
    root.recordError(err);
    root.end();

    log('error', 'checkout.failed', {
      correlationId,
      traceId: root.span.traceId,
      orderId: order.id,
      error: err.message,
      done,
    });

    if (done.includes('shipping')) await cancelShipping(order.id);
    if (done.includes('payment')) await refundPayment(order.id);
    if (done.includes('inventory')) await releaseInventory(order.id, order.qty ?? 1);

    return {
      ok: false,
      orderId: order.id,
      error: err.message,
      code: err.code,
      compensated: done,
      correlationId,
      traceId: root.span.traceId,
      circuit: paymentBreaker.getState(),
    };
  }
}

export async function homepageRecommendations() {
  return withFallback(
    async () => {
      if (paymentBreaker.getState() === 'open') {
        throw new Error('payment_graph_unavailable');
      }
      return { items: ['live-personalized-1', 'live-personalized-2'] };
    },
    async () => ({ items: ['cached-best-seller', 'cached-flash-deal'] }),
  );
}

// --- demo / self-check ---
console.log('=== NM-OK ===');
console.log(await checkoutSaga({ id: 'NM-OK', amount: 500, qty: 1 }));

console.log('\n=== NM-PAYFAIL ===');
console.log(await checkoutSaga({ id: 'NM-PAYFAIL', amount: 500, qty: 1 }));

console.log('\n=== NM-SHIPFAIL ===');
console.log(await checkoutSaga({ id: 'NM-SHIPFAIL', amount: 500, qty: 1 }));

console.log('\n=== flaky payment (retry) ===');
console.log(await checkoutSaga({ id: 'NM-FLAP', amount: 500, qty: 1 }));

console.log('\n=== open circuit with repeated SLOW timeouts ===');
for (let i = 0; i < 4; i++) {
  console.log(await checkoutSaga({ id: `NM-SLOW-${i}`, amount: 500, qty: 1 }));
}

console.log('\n=== homepage graceful degradation ===');
console.log(await homepageRecommendations());

console.log('\nstock left:', stockLeft());
console.log('\n--- spans ---');
tracer.flush();
