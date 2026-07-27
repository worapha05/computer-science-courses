import { randomUUID } from 'node:crypto';
import { catalog, orderStore } from './store.js';
import { corsHeaders } from '../../lib/http.js';

function correlationId(event) {
  return (
    event.headers?.['x-correlation-id'] ||
    event.headers?.['X-Correlation-Id'] ||
    event.requestContext?.requestId ||
    'unknown'
  );
}

function json(statusCode, body, cid) {
  return {
    statusCode,
    headers: {
      'content-type': 'application/json',
      'x-correlation-id': cid,
      ...corsHeaders(),
    },
    body: JSON.stringify(body),
  };
}

export async function ordersHandler(event) {
  const cid = correlationId(event);
  const method = event.requestContext?.http?.method || 'GET';
  const path = event.rawPath || '/';

  if (method === 'POST' && path === '/orders') {
    let payload;
    try {
      payload = JSON.parse(event.body || '{}');
    } catch {
      return json(400, { error: 'invalid_json', correlationId: cid }, cid);
    }

    const { productId, qty } = payload;
    const product = catalog.find((p) => p.id === productId);

    if (!product) {
      return json(400, { error: 'unknown_productId', correlationId: cid }, cid);
    }
    if (!Number.isInteger(qty) || qty < 1 || qty > 10) {
      return json(400, { error: 'qty_must_be_integer_1_to_10', correlationId: cid }, cid);
    }

    const order = {
      id: `ord_${randomUUID().slice(0, 8)}`,
      productId,
      productName: product.name,
      qty,
      total: product.price * qty,
      createdAt: new Date().toISOString(),
    };
    await orderStore.set(order.id, order);
    return json(201, { order, correlationId: cid }, cid);
  }

  const match = path.match(/^\/orders\/([^/]+)$/);
  if (method === 'GET' && match) {
    const order = await orderStore.get(match[1]);
    if (!order) {
      return json(404, { error: 'not_found', correlationId: cid }, cid);
    }
    return json(200, { order, correlationId: cid }, cid);
  }

  return json(404, { error: 'route_not_found', correlationId: cid }, cid);
}
