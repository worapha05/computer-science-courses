import express from 'express';
import { randomUUID } from 'node:crypto';
import { corsHeaders, makeHttpEvent, sendLambdaResponse, log } from '../../lib/http.js';
import { productsHandler } from './products.js';
import { ordersHandler } from './orders.js';

const app = express();
const PORT = process.env.PORT || 3200;

app.use(express.json({ limit: '256kb' }));

app.options('*', (req, res) => {
  for (const [k, v] of Object.entries(corsHeaders(req.headers.origin || '*'))) {
    res.setHeader(k, v);
  }
  res.status(204).end();
});

function toEvent(req) {
  const correlationId =
    req.headers['x-correlation-id'] || req.headers['x-request-id'] || randomUUID();

  return makeHttpEvent({
    method: req.method,
    path: req.path,
    query: req.query,
    headers: { ...req.headers, 'x-correlation-id': correlationId },
    body: ['GET', 'HEAD'].includes(req.method) ? null : req.body,
    pathParams: req.params,
  });
}

async function invoke(handler, req, res) {
  try {
    const event = toEvent(req);
    log('info', 'shoplite.invoke', {
      route: `${req.method} ${req.path}`,
      correlationId: event.headers['x-correlation-id'],
    });
    const result = await handler(event);
    sendLambdaResponse(res, result);
  } catch (err) {
    log('error', 'shoplite.invoke.error', { error: err.message });
    res.status(500).json({ error: 'internal_error', message: err.message });
  }
}

app.get('/products', (req, res) => invoke(productsHandler, req, res));
app.post('/orders', (req, res) => invoke(ordersHandler, req, res));

app.get('/orders/:id', (req, res) => {
  const event = toEvent(req);
  event.rawPath = `/orders/${req.params.id}`;
  event.pathParameters = { id: req.params.id };

  ordersHandler(event)
    .then((result) => sendLambdaResponse(res, result))
    .catch((err) => {
      log('error', 'shoplite.orders.error', { error: err.message });
      res.status(500).json({ error: 'internal_error', message: err.message });
    });
});

app.get('/health', (_req, res) => res.json({ ok: true, service: 'shoplite-gateway' }));

app.use((req, res) => {
  res.status(404).json({
    error: 'route_not_found',
    method: req.method,
    path: req.path,
    correlationId: req.headers['x-correlation-id'] || null,
  });
});

app.listen(PORT, () => {
  console.log(`ShopLite gateway http://localhost:${PORT}`);
});
