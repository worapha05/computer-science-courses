import express from 'express';
import { randomUUID } from 'node:crypto';
import { log } from '../../lib/http.js';
import { listRestaurants, acceptOrder, getOrderComposition, startWorker } from './services.js';

const PORT = process.env.PORT || 3400;
const app = express();

app.use(express.json({ limit: '256kb' }));

startWorker();

app.use((req, res, next) => {
  req.correlationId = req.headers['x-correlation-id'] || randomUUID();
  res.setHeader('x-correlation-id', req.correlationId);
  const started = Date.now();

  res.on('finish', () => {
    log('info', 'gateway.access', {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      ms: Date.now() - started,
      correlationId: req.correlationId,
    });
  });

  next();
});

app.get('/restaurants', async (_req, res, next) => {
  try {
    res.json({ items: await listRestaurants() });
  } catch (err) {
    next(err);
  }
});

app.post('/orders', async (req, res) => {
  try {
    const order = await acceptOrder(req.body, req.correlationId);
    res.status(202).json({
      status: 'accepted',
      orderId: order.id,
      poll: `/orders/${order.id}`,
      correlationId: req.correlationId,
    });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message, correlationId: req.correlationId });
  }
});

app.get('/orders/:id', async (req, res, next) => {
  try {
    const view = await getOrderComposition(req.params.id);
    if (!view) {
      return res.status(404).json({ error: 'not_found', correlationId: req.correlationId });
    }
    res.json({ ...view, correlationId: req.correlationId });
  } catch (err) {
    next(err);
  }
});

app.get('/health', (_req, res) => res.json({ ok: true, service: 'fooddash-gateway' }));

app.use((req, res) => {
  res.status(404).json({
    error: 'route_not_found',
    method: req.method,
    path: req.path,
    correlationId: req.correlationId || null,
  });
});

app.listen(PORT, () => {
  console.log(`FoodDash gateway http://localhost:${PORT}`);
});
