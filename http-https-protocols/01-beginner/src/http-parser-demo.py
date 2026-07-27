#!/usr/bin/env python3
"""
Parse raw HTTP request/response text into structured parts.

Usage:
  python3 http-parser-demo.py
  python3 http-parser-demo.py sample-request.http
"""

from __future__ import annotations

import json
import sys
from pathlib import Path


SAMPLE_REQUEST = (
    "POST /api/login HTTP/1.1\r\n"
    "Host: api.example.com\r\n"
    "User-Agent: parser-demo/1.0\r\n"
    "Content-Type: application/json\r\n"
    "Content-Length: 38\r\n"
    "Cookie: theme=dark; lang=th\r\n"
    "\r\n"
    '{"username":"ada","password":"secret"}'
)

SAMPLE_RESPONSE = (
    "HTTP/1.1 200 OK\r\n"
    "Content-Type: application/json\r\n"
    "Set-Cookie: session_id=abc123; HttpOnly; Path=/\r\n"
    "Cache-Control: no-store\r\n"
    "Content-Length: 18\r\n"
    "\r\n"
    '{"ok":true,"id":1}'
)


def parse_headers(header_block: str) -> dict[str, str]:
    headers: dict[str, str] = {}
    for line in header_block.split("\r\n"):
        if not line or ":" not in line:
            continue
        name, value = line.split(":", 1)
        key = name.strip().lower()
        # combine duplicate headers with comma (simplified RFC 9110 style)
        if key in headers:
            headers[key] = f"{headers[key]}, {value.strip()}"
        else:
            headers[key] = value.strip()
    return headers


def parse_cookies(cookie_header: str | None) -> dict[str, str]:
    if not cookie_header:
        return {}
    out: dict[str, str] = {}
    for part in cookie_header.split(";"):
        part = part.strip()
        if "=" not in part:
            continue
        k, v = part.split("=", 1)
        out[k.strip()] = v.strip()
    return out


def parse_http_message(raw: str, kind: str = "auto") -> dict:
    if "\r\n\r\n" not in raw:
        raise ValueError("Invalid HTTP message: missing header/body separator CRLF CRLF")

    head, body = raw.split("\r\n\r\n", 1)
    lines = head.split("\r\n")
    start_line = lines[0]
    headers = parse_headers("\r\n".join(lines[1:]))

    detected = kind
    if kind == "auto":
        detected = "response" if start_line.startswith("HTTP/") else "request"

    result: dict = {
        "kind": detected,
        "start_line": start_line,
        "headers": headers,
        "body": body,
        "body_length": len(body.encode("utf-8")),
    }

    if detected == "request":
        parts = start_line.split(" ")
        if len(parts) != 3:
            raise ValueError(f"Malformed request line: {start_line!r}")
        method, target, version = parts
        result.update(
            {
                "method": method,
                "target": target,
                "version": version,
                "cookies": parse_cookies(headers.get("cookie")),
            }
        )
    else:
        parts = start_line.split(" ", 2)
        if len(parts) < 2:
            raise ValueError(f"Malformed status line: {start_line!r}")
        result.update(
            {
                "version": parts[0],
                "status_code": int(parts[1]),
                "reason": parts[2] if len(parts) > 2 else "",
            }
        )

    declared = headers.get("content-length")
    if declared is not None and int(declared) != result["body_length"]:
        result["warning"] = (
            f"Content-Length={declared} but actual body bytes={result['body_length']}"
        )

    return result


def main() -> None:
    if len(sys.argv) > 1:
        raw = Path(sys.argv[1]).read_text(encoding="utf-8")
        # allow files saved with bare LF
        if "\r\n" not in raw:
            raw = raw.replace("\n", "\r\n")
        parsed = parse_http_message(raw)
        print(json.dumps(parsed, ensure_ascii=False, indent=2))
        return

    print("=== Request ===")
    print(json.dumps(parse_http_message(SAMPLE_REQUEST), ensure_ascii=False, indent=2))
    print("\n=== Response ===")
    print(json.dumps(parse_http_message(SAMPLE_RESPONSE), ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
