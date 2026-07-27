#!/usr/bin/env bash
# Inspect TLS version, cipher, and certificate chain for a host.
# Usage:
#   ./tls-inspect.sh 127.0.0.1:8443
#   ./tls-inspect.sh example.com:443
set -euo pipefail

TARGET="${1:-127.0.0.1:8443}"
HOST="${TARGET%%:*}"
PORT="${TARGET##*:}"
CA_FILE="$(cd "$(dirname "$0")" && pwd)/certs/ca.cert.pem"

echo "=== TLS inspect: ${HOST}:${PORT} ==="

OPENSSL_ARGS=(-connect "${HOST}:${PORT}" -servername "${HOST}")
if [[ -f "$CA_FILE" ]]; then
  OPENSSL_ARGS+=(-CAfile "$CA_FILE")
  echo "[*] Using lab CA: $CA_FILE"
fi

echo
echo "--- Certificate (subject / issuer / dates) ---"
echo | openssl s_client "${OPENSSL_ARGS[@]}" 2>/dev/null | openssl x509 -noout -subject -issuer -dates -text | grep -A1 'Subject Alternative Name' || true

echo
echo "--- Negotiated protocol & cipher ---"
echo | openssl s_client "${OPENSSL_ARGS[@]}" 2>/dev/null | awk '/Protocol|Cipher|Verify return code|Peer signature/'

echo
echo "--- Test TLS 1.2 only ---"
echo | openssl s_client "${OPENSSL_ARGS[@]}" -tls1_2 2>/dev/null | awk '/Protocol|Cipher|Verify return code/' || echo "(TLS 1.2 failed)"

echo
echo "--- Test TLS 1.3 only ---"
echo | openssl s_client "${OPENSSL_ARGS[@]}" -tls1_3 2>/dev/null | awk '/Protocol|Cipher|Verify return code/' || echo "(TLS 1.3 failed)"

echo
echo "--- Chain depth (brief) ---"
echo | openssl s_client "${OPENSSL_ARGS[@]}" -showcerts 2>/dev/null | grep -E 's:|i:|Verify return code' || true
