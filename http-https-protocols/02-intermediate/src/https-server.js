#!/usr/bin/env node
/**
 * HTTPS server with security headers (lab).
 *
 * Prerequisites:
 * cd certs && ./generate-certs.sh
 *
 * Run:
 * node https-server.js
 *
 * Test:
 * curl -vk --cacert certs/ca.cert.pem https://127.0.0.1:8443/
 * curl -vk --cacert certs/ca.cert.pem -c /tmp/cj -b /tmp/cj \
 *  -X POST -H 'Content-Type: application/json' -d '{"user":"ada"}' \
 *  https://127.0.0.1:8443/login
 */

'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');
const crypto = require('crypto');
const tls = require('tls');

const ROOT = __dirname;
const PORT = Number(process.env.PORT || 8443);
const sessions = new Map();

const options = {
  key: fs.readFileSync(path.join(ROOT, 'certs/server.key.pem')),
  cert: fs.readFileSync(path.join(ROOT, 'certs/fullchain.pem')),
  minVersion: 'TLSv1.2',
  maxVersion: 'TLSv1.3',
};

function securityHeaders() {
  return {
    'Strict-Transport-Security': 'max-age=300; includeSubDomains', // short for lab
    'Content-Security-Policy':
      "default-src 'self'; script-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'",
    'X-Frame-Options': 'DENY',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Cache-Control': 'no-store',
  };
}

function parseCookies(header = '') {
  const out = {};
  for (const part of header.split(';')) {
    const [k, ...rest] = part.trim().split('=');
    if (!k) continue;
    out[k] = decodeURIComponent(rest.join('=') || '');
  }
  return out;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function send(res, status, body, extra = {}) {
  const payload = typeof body === 'string' ? body : JSON.stringify(body, null, 2);
  const headers = {
    ...securityHeaders(),
    'Content-Type': typeof body === 'string' ? 'text/html; charset=utf-8' : 'application/json',
    'Content-Length': Buffer.byteLength(payload),
  };
  Object.assign(headers, extra);
  res.writeHead(status, headers);
  res.end(payload);
}

const server = https.createServer(options, async (req, res) => {
  const url = new URL(req.url, `https://${req.headers.host || 'localhost'}`);

  if (req.method === 'GET' && url.pathname === '/') {
    return send(
      res,
      200,
      `<!doctype html><html><body>
  <h1>HTTPS Lab Server</h1>
  <p>TLS OK. Check response headers for HSTS/CSP/XFO.</p>
  <p>Protocol: ${req.socket.getProtocol?.() || 'n/a'}</p>
  </body></html>`,
    );
  }

  if (req.method === 'GET' && url.pathname === '/tls') {
    const sock = req.socket;
    return send(res, 200, {
      tlsProtocol: sock.getProtocol(),
      cipher: sock.getCipher(),
      authorized: sock.authorized,
      servername: sock.servername,
    });
  }

  if (req.method === 'POST' && url.pathname === '/login') {
    const raw = await readBody(req);
    let user;
    try {
      user = JSON.parse(raw).user;
    } catch {
      return send(res, 400, { error: 'invalid JSON' });
    }
    const sid = crypto.randomBytes(16).toString('hex');
    sessions.set(sid, { user, at: Date.now() });
    const cookie = [
      `session_id=${sid}`,
      'Path=/',
      'HttpOnly',
      'Secure',
      'SameSite=Lax',
      'Max-Age=3600',
    ].join('; ');
    return send(res, 200, { ok: true, user }, { 'Set-Cookie': cookie });
  }

  if (req.method === 'GET' && url.pathname === '/me') {
    const sid = parseCookies(req.headers.cookie).session_id;
    const session = sid && sessions.get(sid);
    if (!session) return send(res, 401, { error: 'unauthorized' });
    return send(res, 200, { user: session.user });
  }

  send(res, 404, { error: 'not found' });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`HTTPS server on https://127.0.0.1:${PORT}/`);
  console.log(`Supported: ${tls.getCiphers().length} ciphers (Node default list)`);
});
