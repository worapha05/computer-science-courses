#!/usr/bin/env node
/**
 * HTTP/2 multiplexing demo (server + parallel client).
 *
 * node h2-multiplex-demo.js
 *
 * Opens an HTTP/2 cleartext (h2c) server for lab simplicity.
 * Browsers require TLS+ALPN for h2; use curl --http2-prior-knowledge for h2c.
 */

'use strict';

const http2 = require('http2');

const PORT = Number(process.env.PORT || 8442);

const server = http2.createServer();

server.on('stream', (stream, headers) => {
  const path = headers[':path'] || '/';
  const delay = path.startsWith('/slow') ? 500 : 50;

  setTimeout(() => {
    stream.respond({
      ':status': 200,
      'content-type': 'application/json',
      'cache-control': 'no-store',
    });
    stream.end(
      JSON.stringify({
        path,
        delayMs: delay,
        message: 'multiplexed response',
        at: Date.now(),
      }) + '\n',
    );
  }, delay);
});

server.listen(PORT, '127.0.0.1', async () => {
  console.log(`HTTP/2 (h2c) server on http://127.0.0.1:${PORT}/`);
  console.log('Running parallel client over ONE connection...\n');

  const client = http2.connect(`http://127.0.0.1:${PORT}`);
  client.on('error', (err) => console.error(err));

  const paths = ['/fast/a', '/slow/b', '/fast/c', '/slow/d', '/fast/e'];
  const started = Date.now();

  await Promise.all(
    paths.map(
      (p) =>
        new Promise((resolve, reject) => {
          const req = client.request({ ':path': p });
          let data = '';
          req.setEncoding('utf8');
          req.on('data', (c) => (data += c));
          req.on('end', () => {
            console.log(`← ${p} (+${Date.now() - started}ms) ${data.trim()}`);
            resolve();
          });
          req.on('error', reject);
          req.end();
        }),
    ),
  );

  console.log(`\nAll streams done in ${Date.now() - started}ms (note overlap vs serial HTTP/1.1)`);
  console.log('Try: curl --http2-prior-knowledge http://127.0.0.1:' + PORT + '/fast/x');
  client.close();
  // keep server up for manual curls
});
