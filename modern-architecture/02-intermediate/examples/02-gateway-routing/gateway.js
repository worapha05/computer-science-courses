/**
 * API Gateway: reverse proxy + routing table + access logs
 */
import express from 'express';
import { randomUUID } from 'node:crypto';
import { log } from '../../lib/http.js';
import { startOrdersService, startPaymentsService } from './upstreams.js';

const GATEWAY_PORT = process.env.PORT || 3300;
const ORDERS_PORT = Number(process.env.ORDERS_PORT || 3301);
const PAYMENTS_PORT = Number(process.env.PAYMENTS_PORT || 3302);

startOrdersService(ORDERS_PORT);
startPaymentsService(PAYMENTS_PORT);

const routes = [
  { prefix: '/api/orders', target: `http://127.0.0.1:${ORDERS_PORT}`, strip: '/api/orders' },
  { prefix: '/api/payments', target: `http://127.0.0.1:${PAYMENTS_PORT}`, strip: '/api/payments' },
];

const app = express();

app.use(async (req, res) => {
  const correlationId = req.headers['x-correlation-id'] || randomUUID();
  const started = Date.now();
  const match = routes.find((r) => req.path.startsWith(r.prefix));

  if (!match) {
    log('warn', 'gateway.access', {
      method: req.method,
      path: req.path,
      status: 404,
      ms: Date.now() - started,
      correlationId,
    });
    return res.status(404).json({ error: 'no_route', correlationId });
  }

  const upstreamPath = req.path.slice(match.strip.length) || '/';
  const queryString = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
  const url = `${match.target}${upstreamPath}${queryString}`;

  try {
    const upstream = await fetch(url, {
      method: req.method,
      headers: {
        'x-correlation-id': correlationId,
        accept: 'application/json',
      },
    });
    const text = await upstream.text();

    log('info', 'gateway.access', {
      method: req.method,
      path: req.path,
      upstream: url,
      status: upstream.status,
      ms: Date.now() - started,
      correlationId,
    });

    res.status(upstream.status);
    res.setHeader('x-correlation-id', correlationId);
    res.setHeader('content-type', upstream.headers.get('content-type') || 'application/json');
    res.send(text);
  } catch (err) {
    log('error', 'gateway.upstream_error', {
      path: req.path,
      error: err.message,
      correlationId,
      ms: Date.now() - started,
    });
    res.status(502).json({ error: 'bad_gateway', correlationId });
  }
});

app.listen(GATEWAY_PORT, () => {
  console.log(`Gateway http://localhost:${GATEWAY_PORT}`);
  console.log('  /api/orders/* → :3301');
  console.log('  /api/payments/* → :3302');
});
