#!/usr/bin/env node
/**
 * Minimal raw HTTP client over TCP.
 *
 * Usage:
 * node raw-http-client.js
 * node raw-http-client.js GET /headers
 * node raw-http-client.js POST /echo '{"hello":"world"}'
 */

'use strict';

const net = require('net');

const HOST = process.env.HOST || '127.0.0.1';
const PORT = Number(process.env.PORT || 8080);
const method = (process.argv[2] || 'GET').toUpperCase();
const path = process.argv[3] || '/';
const body = process.argv[4] || '';

const headers = [
  `${method} ${path} HTTP/1.1`,
  `Host: ${HOST}:${PORT}`,
  'User-Agent: raw-http-client/1.0',
  'Accept: */*',
  'Connection: close',
];

if (body) {
  headers.push('Content-Type: application/json');
  headers.push(`Content-Length: ${Buffer.byteLength(body)}`);
}

const request = headers.join('\r\n') + '\r\n\r\n' + body;

const socket = net.createConnection({ host: HOST, port: PORT }, () => {
  console.log('>>> sending raw request:\n');
  console.log(request.replace(/\r\n/g, '\\r\\n\n'));
  socket.write(request);
});

let response = '';

socket.on('data', (chunk) => {
  response += chunk.toString('utf8');
});

socket.on('end', () => {
  console.log('\n<<< raw response:\n');
  console.log(response);
});

socket.on('error', (err) => {
  console.error('connection error:', err.message);
  process.exit(1);
});
