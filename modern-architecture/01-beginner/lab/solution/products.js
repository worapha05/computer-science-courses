import { catalog } from './store.js';
import { corsHeaders } from '../../lib/http.js';

function correlationId(event) {
  return (
    event.headers?.['x-correlation-id'] ||
    event.headers?.['X-Correlation-Id'] ||
    event.requestContext?.requestId ||
    'unknown'
  );
}

export async function productsHandler(event) {
  const cid = correlationId(event);
  const category = event.queryStringParameters?.category;
  const items = category ? catalog.filter((p) => p.category === category) : catalog;

  return {
    statusCode: 200,
    headers: {
      'content-type': 'application/json',
      'x-correlation-id': cid,
      ...corsHeaders(),
    },
    body: JSON.stringify({ items, correlationId: cid }),
  };
}
