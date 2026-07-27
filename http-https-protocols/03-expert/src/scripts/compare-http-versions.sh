#!/usr/bin/env bash
# Compare HTTP/1.1 vs HTTP/2 timings for the same URL (when server supports both).
# Usage: ./compare-http-versions.sh https://example.com/
set -euo pipefail

URL="${1:?usage: $0 https://host/path}"
ROUNDS="${ROUNDS:-5}"

run_batch() {
  local flag="$1"
  local label="$2"
  local sum=0
  local i t
  echo "=== $label ($ROUNDS requests) ==="
  for i in $(seq 1 "$ROUNDS"); do
    t=$(curl -sS -o /dev/null "$flag" -w '%{time_total}' "$URL" || echo 0)
    echo "  #$i total=${t}s"
    sum=$(awk -v a="$sum" -v b="$t" 'BEGIN { printf "%.6f", a + b }')
  done
  awk -v s="$sum" -v n="$ROUNDS" 'BEGIN { printf "  avg=%.6fs\n\n", s / n }'
}

# Note: --http1.1 / --http2 may fail if the server/path doesn't allow that version.
run_batch '--http1.1' 'HTTP/1.1'
run_batch '--http2' 'HTTP/2'

echo "Also check negotiated version:"
curl -sS -o /dev/null -w 'default negotiate -> HTTP/%{http_version}\n' "$URL" || true
