/**
 * Local invoke — ไม่ต้องมี AWS SAM
 */
import { makeHttpEvent } from '../../lib/http.js';
import { handler } from './handler.js';

const cases = [
  makeHttpEvent({ method: 'GET', path: '/hello', query: { name: 'Ada' } }),
  makeHttpEvent({ method: 'POST', path: '/hello', body: { name: 'Grace' } }),
  makeHttpEvent({ method: 'GET', path: '/hello' }),
];

for (const event of cases) {
  const result = await handler(event);
  console.log(event.requestContext.http.method, event.rawPath, '→', result.statusCode);
  console.log(result.body);
  console.log('---');
}
