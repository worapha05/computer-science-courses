#!/usr/bin/env node
/**
 * Cookie-based session demo (educational — not production-ready).
 *
 * node cookie-session-server.js
 * curl -c /tmp/cj -b /tmp/cj -v -X POST -H 'Content-Type: application/json' \
 *  -d '{"user":"ada"}' http://127.0.0.1:8081/login
 * curl -c /tmp/cj -b /tmp/cj -v http://127.0.0.1:8081/me
 */

'use strict';

const http = require('http');
const crypto = require('crypto');

const PORT = Number(process.env.PORT || 8081);
const sessions = new Map(); // sessionId -> { user, createdAt }

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

function json(res, status, obj, extraHeaders = {}) {
  const body = JSON.stringify(obj, null, 2);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(body),
    ...extraHeaders,
  });
  res.end(body);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

  if (req.method === 'POST' && url.pathname === '/login') {
    const raw = await readBody(req);
    let user;
    try {
      user = JSON.parse(raw).user;
    } catch {
      return json(res, 400, { error: 'invalid JSON' });
    }
    if (!user) return json(res, 400, { error: 'user required' });

    const sessionId = crypto.randomBytes(16).toString('hex');
    sessions.set(sessionId, { user, createdAt: Date.now() });

    // Educational defaults — Intermediate level adds Secure/SameSite properly for HTTPS
    const cookie = [
      `session_id=${sessionId}`,
      'Path=/',
      'HttpOnly',
      'SameSite=Lax',
      'Max-Age=3600',
    ].join('; ');

    return json(res, 200, { ok: true, user }, { 'Set-Cookie': cookie });
  }

  if (req.method === 'GET' && url.pathname === '/me') {
    const cookies = parseCookies(req.headers.cookie);
    const sid = cookies.session_id;
    const session = sid && sessions.get(sid);
    if (!session) {
      return json(res, 401, { error: 'unauthorized — login first' });
    }
    return json(res, 200, {
      user: session.user,
      sessionAgeMs: Date.now() - session.createdAt,
      note: 'HTTP is still stateless; the cookie carries the session key',
    });
  }

  if (req.method === 'POST' && url.pathname === '/logout') {
    const cookies = parseCookies(req.headers.cookie);
    if (cookies.session_id) sessions.delete(cookies.session_id);
    return json(
      res,
      200,
      { ok: true },
      { 'Set-Cookie': 'session_id=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax' },
    );
  }

  json(res, 404, {
    error: 'not found',
    endpoints: ['POST /login', 'GET /me', 'POST /logout'],
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Cookie session server on http://127.0.0.1:${PORT}/`);
});
