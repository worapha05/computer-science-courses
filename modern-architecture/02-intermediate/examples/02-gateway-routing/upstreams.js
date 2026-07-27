/**
 * Upstream microservices จำลอง
 */
import express from 'express';

function listen(app, port, label) {
  const server = app.listen(port, () => console.log(`${label} :${port}`));
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(
        `${label} port ${port} ถูกใช้อยู่แล้ว — ปิด process เก่าก่อน หรือตั้ง ORDERS_PORT / PAYMENTS_PORT`,
      );
    }
    throw err;
  });
  return server;
}

export function startOrdersService(port = Number(process.env.ORDERS_PORT || 3301)) {
  const app = express();

  app.get('/ping', (req, res) => {
    res.json({
      service: 'orders',
      correlationId: req.headers['x-correlation-id'] || null,
    });
  });

  app.get('/orders/:id', (req, res) => {
    res.json({ service: 'orders', id: req.params.id, status: 'paid' });
  });

  return listen(app, port, 'orders-svc');
}

export function startPaymentsService(port = Number(process.env.PAYMENTS_PORT || 3302)) {
  const app = express();

  app.get('/ping', (req, res) => {
    res.json({
      service: 'payments',
      correlationId: req.headers['x-correlation-id'] || null,
    });
  });

  app.get('/charges/:id', (req, res) => {
    res.json({ service: 'payments', chargeId: req.params.id, amount: 1290 });
  });

  return listen(app, port, 'payments-svc');
}
