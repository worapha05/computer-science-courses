#!/usr/bin/env bash
# Profile a URL: protocol version + timing breakdown.
# Usage: ./profile-url.sh https://example.com/
set -euo pipefail

URL="${1:-https://example.com/}"

echo "Profiling: $URL"
echo

curl -sS -o /dev/null -D /tmp/profile-headers.$$ "$URL" \
  -w "http_version=%{http_version}\nhttp_code=%{http_code}\nremote_ip=%{remote_ip}\nnamelookup=%{time_namelookup}s\nconnect=%{time_connect}s\nappconnect_tls=%{time_appconnect}s\npretransfer=%{time_pretransfer}s\nstarttransfer_ttfb=%{time_starttransfer}s\ntotal=%{time_total}s\nsize_download=%{size_download}\nspeed_download=%{speed_download}\n" \
  || true

echo
echo "--- Response headers (selected) ---"
grep -iE '^(HTTP/|content-type:|cache-control:|strict-transport|content-security|alt-svc:|server:)' /tmp/profile-headers.$$ || true
rm -f /tmp/profile-headers.$$

echo
echo "Interpretation tips:"
echo "  namelookup high     -> DNS"
echo "  connect - namelookup high -> TCP / routing"
echo "  appconnect - connect high -> TLS handshake"
echo "  starttransfer - appconnect high -> server think time (TTFB)"
echo "  total - starttransfer high -> payload download"
