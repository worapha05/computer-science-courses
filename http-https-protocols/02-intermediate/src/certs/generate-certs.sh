#!/usr/bin/env bash
# Generate a lab-only Root CA and a leaf certificate for localhost / 127.0.0.1
# DO NOT use these keys in production.
set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

DAYS_CA="${DAYS_CA:-3650}"
DAYS_LEAF="${DAYS_LEAF:-825}"
CN="${CN:-localhost}"

echo "[*] Generating Root CA..."
openssl genrsa -out ca.key.pem 4096
openssl req -x509 -new -nodes -key ca.key.pem -sha256 -days "$DAYS_CA" \
  -subj "/C=TH/O=HTTP-HTTPS Bootcamp Lab/CN=Bootcamp Lab Root CA" \
  -out ca.cert.pem

echo "[*] Generating leaf private key + CSR for CN=${CN}..."
openssl genrsa -out server.key.pem 2048

cat > leaf.ext << EOF
authorityKeyIdentifier=keyid,issuer
basicConstraints=CA:FALSE
keyUsage = digitalSignature, keyEncipherment
extendedKeyUsage = serverAuth
subjectAltName = @alt_names

[alt_names]
DNS.1 = localhost
DNS.2 = ${CN}
IP.1 = 127.0.0.1
EOF

openssl req -new -key server.key.pem \
  -subj "/C=TH/O=HTTP-HTTPS Bootcamp Lab/CN=${CN}" \
  -out server.csr.pem

openssl x509 -req -in server.csr.pem -CA ca.cert.pem -CAkey ca.key.pem \
  -CAcreateserial -out server.cert.pem -days "$DAYS_LEAF" -sha256 \
  -extfile leaf.ext

# full chain = leaf + intermediate/root (here root acts as issuer)
cat server.cert.pem ca.cert.pem > fullchain.pem

# Intentionally broken cert for Lab (wrong SAN)
openssl genrsa -out wrong-san.key.pem 2048
openssl req -new -key wrong-san.key.pem \
  -subj "/C=TH/O=HTTP-HTTPS Bootcamp Lab/CN=wrong.example" \
  -out wrong-san.csr.pem
cat > wrong-san.ext << EOF
basicConstraints=CA:FALSE
keyUsage = digitalSignature, keyEncipherment
extendedKeyUsage = serverAuth
subjectAltName = DNS:wrong.example
EOF
openssl x509 -req -in wrong-san.csr.pem -CA ca.cert.pem -CAkey ca.key.pem \
  -CAcreateserial -out wrong-san.cert.pem -days 30 -sha256 \
  -extfile wrong-san.ext

rm -f server.csr.pem wrong-san.csr.pem leaf.ext wrong-san.ext ca.cert.srl

echo "[+] Done. Files in ${DIR}:"
ls -1 ca.cert.pem ca.key.pem server.cert.pem server.key.pem fullchain.pem wrong-san.*
echo
echo "Trust the lab CA (optional, for browsers):"
echo "  ca.cert.pem"
echo "Verify:"
echo "  openssl verify -CAfile ca.cert.pem server.cert.pem"
