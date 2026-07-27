/**
 * Local API Gateway → Lambda handlers
 */
import express from 'express';
import { corsHeaders, makeHttpEvent, sendLambdaResponse, log } from '../../lib/http.js';
import { handler as helloHandler } from '../03-first-function/handler.js';

const app = express();
const PORT = process.env.PORT || 3100;

app.use(express.json({ limit: '1mb' }));

// CORS preflight ระดับ gateway
app.options('*', (req, res) => {
  for (const [k, v] of Object.entries(corsHeaders(req.headers.origin || '*'))) {
    res.setHeader(k, v);
  }
  res.status(204).end();
});

function toLambdaEvent(req) {
  return makeHttpEvent({
    method: req.method,
    path: req.path,
    query: req.query,
    headers: {
      ...req.headers,
      'x-correlation-id':
        req.headers['x-correlation-id'] || req.headers['x-request-id'] || `gw-${Date.now()}`,
    },
    body: req.method === 'GET' || req.method === 'HEAD' ? null : req.body,
    pathParams: req.params,
  });
}

async function invoke(handler, req, res) {
  const event = toLambdaEvent(req);

  log('info', 'gateway.invoke', {
    route: `${req.method} ${req.path}`,
    correlationId: event.headers['x-correlation-id'],
  });

  try {
    const result = await handler(event);
    sendLambdaResponse(res, result);
  } catch (err) {
    log('error', 'gateway.handler_error', { error: err.message });
    res.status(500).json({ error: 'internal_error' });
  }
}

app.get('/hello', (req, res) => invoke(helloHandler, req, res));
app.post('/hello', (req, res) => invoke(helloHandler, req, res));

app.get('/echo', async (req, res) => {
  const event = toLambdaEvent(req);

  sendLambdaResponse(res, {
    statusCode: 200,
    headers: { 'content-type': 'application/json', ...corsHeaders() },
    body: JSON.stringify({
      message: 'gateway echo',
      method: event.requestContext.http.method,
      path: event.rawPath,
      query: event.queryStringParameters ?? {},
      correlationId: event.headers['x-correlation-id'],
      userAgent: event.headers['user-agent'],
    }),
  });
});

app.get('/health', (_req, res) => res.json({ ok: true }));

// JSON 404 — ใกล้เคียง API Gateway มากกว่าหน้า HTML ของ Express
app.use((req, res) => {
  res.status(404).json({
    error: 'route_not_found',
    method: req.method,
    path: req.path,
  });
});

app.listen(PORT, () => {
  console.log(`Local API Gateway on http://localhost:${PORT}`);
  console.log(`  GET /hello?name=Ada`);
  console.log(`  GET /echo`);
  console.log(`  GET /health`);
});
