/**
 * AWS Lambda-style handler — ทักทายจาก query/body
 */
import { corsHeaders } from '../../lib/http.js';

export async function handler(event) {
  const qs = event.queryStringParameters ?? {};
  let bodyName;

  if (event.body) {
    try {
      bodyName = JSON.parse(event.body)?.name;
    } catch {
      return {
        statusCode: 400,
        headers: { 'content-type': 'application/json', ...corsHeaders() },
        body: JSON.stringify({ error: 'invalid_json' }),
      };
    }
  }

  const name = qs.name || bodyName || 'World';
  const requestId = event.requestContext?.requestId ?? 'local';

  return {
    statusCode: 200,
    headers: {
      'content-type': 'application/json',
      'x-request-id': requestId,
      ...corsHeaders(),
    },
    body: JSON.stringify({
      message: `Hello, ${name}!`,
      runtime: 'nodejs-lambda-style',
      requestId,
    }),
  };
}
