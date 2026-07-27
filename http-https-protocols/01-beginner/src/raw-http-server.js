#!/usr/bin/env node
/**
 * Raw HTTP/1.1 server using only Node.js `net` (TCP).
 * No `http` module — you see the protocol as plain text on a byte stream.
 *
 * Usage: node raw-http-server.js
 * Test: curl -v http://127.0.0.1:8080/
 *  curl -v -X POST -H 'Content-Type: application/json' -d '{"n":1}' http://127.0.0.1:8080/echo
 */

'use strict';

const net = require('net');

const PORT = Number(process.env.PORT || 8080);
const HOST = process.env.HOST || '127.0.0.1';

function parseHttpRequest(buffer) {
  const text = buffer.toString('utf8');
  const headerEnd = text.indexOf('\r\n\r\n');
  if (headerEnd === -1) {
    return null; // need more data
  }

  const head = text.slice(0, headerEnd);
  const body = text.slice(headerEnd + 4);
  const lines = head.split('\r\n');
  const [method, target, version] = lines[0].split(' ');

  const headers = {};
  for (let i = 1; i < lines.length; i++) {
    const idx = lines[i].indexOf(':');
    if (idx === -1) continue;
    const name = lines[i].slice(0, idx).trim().toLowerCase();
    const value = lines[i].slice(idx + 1).trim();
    headers[name] = value;
  }

  const contentLength = headers['content-length'] ? Number(headers['content-length']) : 0;

  if (body.length < contentLength) {
    return null; // wait for full body
  }

  return {
    method,
    target,
    version,
    headers,
    body: body.slice(0, contentLength),
    rawHead: head,
  };
}

function buildResponse(statusCode, reason, headers, body) {
  const payload = body == null ? '' : String(body);
  const base = {
    'Content-Length': Buffer.byteLength(payload),
    Connection: 'close',
    Server: 'raw-http-lab/1.0',
    ...headers,
  };

  let msg = `HTTP/1.1 ${statusCode} ${reason}\r\n`;
  for (const [k, v] of Object.entries(base)) {
    msg += `${k}: ${v}\r\n`;
  }
  msg += `\r\n${payload}`;
  return msg;
}

function route(req) {
  const path = req.target.split('?')[0];

  if (req.method === 'GET' && path === '/') {
    const html = `<!doctype html>
<html><body>
 <h1>Raw HTTP Server</h1>
 <p>You are speaking HTTP/1.1 over TCP.</p>
 <ul>
 <li>GET /headers — echo parsed headers</li>
 <li>POST /echo — echo JSON body</li>
 <li>GET /status/404 — demo status codes</li>
 </ul>
</body></html>`;
    return buildResponse(200, 'OK', { 'Content-Type': 'text/html; charset=utf-8' }, html);
  }

  if (req.method === 'GET' && path === '/headers') {
    return buildResponse(
      200,
      'OK',
      { 'Content-Type': 'application/json' },
      JSON.stringify(
        { startLine: `${req.method} ${req.target} ${req.version}`, headers: req.headers },
        null,
        2,
      ),
    );
  }

  if (req.method === 'POST' && path === '/echo') {
    return buildResponse(
      200,
      'OK',
      { 'Content-Type': 'application/json' },
      JSON.stringify({ received: req.body, contentType: req.headers['content-type'] || null }),
    );
  }

  const statusMatch = path.match(/^\/status\/(\d{3})$/);
  if (req.method === 'GET' && statusMatch) {
    const code = Number(statusMatch[1]);
    return buildResponse(code, 'Custom', { 'Content-Type': 'text/plain' }, `Status ${code}\n`);
  }

  return buildResponse(404, 'Not Found', { 'Content-Type': 'text/plain' }, 'Not Found\n');
}

const server = net.createServer((socket) => {
  let buf = Buffer.alloc(0);

  socket.setTimeout(30000);
  socket.on('timeout', () => {
    socket.end(
      buildResponse(408, 'Request Timeout', { 'Content-Type': 'text/plain' }, 'Timeout\n'),
    );
  });

  socket.on('data', (chunk) => {
    buf = Buffer.concat([buf, chunk]);
    const req = parseHttpRequest(buf);
    if (!req) return;

    console.log('---- raw request head ----');
    console.log(req.rawHead);
    console.log('--------------------------');

    if (!req.headers.host) {
      socket.end(
        buildResponse(
          400,
          'Bad Request',
          { 'Content-Type': 'text/plain' },
          'Missing Host header\n',
        ),
      );
      return;
    }

    socket.end(route(req));
  });

  socket.on('error', (err) => {
    console.error('socket error:', err.message);
  });
});

server.listen(PORT, HOST, () => {
  console.log(`Raw HTTP server listening on http://${HOST}:${PORT}/`);
});
