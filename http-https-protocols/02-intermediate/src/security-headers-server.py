#!/usr/bin/env python3
"""
Security headers demo server (HTTP for header inspection; use behind TLS in real life).

  python3 security-headers-server.py
  curl -sD - http://127.0.0.1:8082/ -o /dev/null
"""

from __future__ import annotations

from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer


SECURITY_HEADERS = {
    "Strict-Transport-Security": "max-age=63072000; includeSubDomains",
    "Content-Security-Policy": (
        "default-src 'self'; "
        "script-src 'self'; "
        "img-src 'self' data:; "
        "object-src 'none'; "
        "base-uri 'self'; "
        "frame-ancestors 'none'"
    ),
    "X-Frame-Options": "DENY",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "geolocation=(), microphone=(), camera=()",
    "Cache-Control": "no-store",
}


class Handler(BaseHTTPRequestHandler):
    def _send(self, code: int, body: bytes, content_type: str, set_cookie: str | None = None) -> None:
        self.send_response(code)
        for k, v in SECURITY_HEADERS.items():
            self.send_header(k, v)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        if set_cookie:
            self.send_header("Set-Cookie", set_cookie)
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:  # noqa: N802
        if self.path == "/headers":
            # Echo request headers as plain text for lab analysis
            lines = [f"{k}: {v}" for k, v in self.headers.items()]
            body = ("Request headers received:\n" + "\n".join(lines) + "\n").encode()
            self._send(200, body, "text/plain; charset=utf-8")
            return

        if self.path == "/set-cookie":
            cookie = "session_id=demo; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600"
            body = b'{"ok":true,"note":"Secure cookie requires HTTPS to be stored by browsers"}\n'
            self._send(200, body, "application/json", set_cookie=cookie)
            return

        html = b"""<!doctype html>
<html>
<head><title>Security Headers Lab</title></head>
<body>
  <h1>Security Headers</h1>
  <p>Inspect this response with curl -D - or browser DevTools.</p>
  <ul>
    <li><a href="/headers">/headers</a></li>
    <li><a href="/set-cookie">/set-cookie</a></li>
  </ul>
</body>
</html>
"""
        self._send(200, html, "text/html; charset=utf-8")

    def log_message(self, fmt: str, *args) -> None:
        print("%s - %s" % (self.address_string(), fmt % args))


if __name__ == "__main__":
    host, port = "127.0.0.1", 8082
    httpd = ThreadingHTTPServer((host, port), Handler)
    print(f"Security headers server on http://{host}:{port}/")
    httpd.serve_forever()
