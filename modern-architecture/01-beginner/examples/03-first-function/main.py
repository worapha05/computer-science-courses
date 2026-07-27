"""
GCP Cloud Functions (HTTP) style — รันแบบ local ด้วย stdlib
Production: functions-framework หรือ Cloud Functions gen2 / Cloud Run
"""
from __future__ import annotations

import json
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import parse_qs, urlparse


def hello_http(request_method: str, path: str, query: dict, body: bytes) -> tuple[int, dict, dict]:
    name = (query.get("name") or [None])[0]
    if not name and body:
        try:
            name = json.loads(body.decode("utf-8")).get("name")
        except json.JSONDecodeError:
            return 400, {"content-type": "application/json"}, {"error": "invalid_json"}
    name = name or "World"
    payload = {
        "message": f"Hello, {name}!",
        "runtime": "python-cloud-functions-style",
        "method": request_method,
        "path": path,
    }
    return 200, {"content-type": "application/json"}, payload


class Handler(BaseHTTPRequestHandler):
    def _handle(self):
        parsed = urlparse(self.path)
        length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(length) if length else b""
        status, headers, payload = hello_http(
            self.command, parsed.path, parse_qs(parsed.query), body
        )
        raw = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        for k, v in headers.items():
            self.send_header(k, v)
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def do_GET(self):
        self._handle()

    def do_POST(self):
        self._handle()

    def log_message(self, fmt, *args):
        print(f"[python-fn] {self.address_string()} {fmt % args}")


if __name__ == "__main__":
    # demo โดยตรงโดยไม่เปิด server
    status, _, payload = hello_http("GET", "/hello", {"name": ["Lin"]}, b"")
    print(status, payload)

    # optional: python3 main.py --serve
    import sys

    if "--serve" in sys.argv:
        port = 8080
        print(f"Listening on http://127.0.0.1:{port}/hello?name=You")
        HTTPServer(("127.0.0.1", port), Handler).serve_forever()
