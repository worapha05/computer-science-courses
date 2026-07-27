# Wireshark / tcpdump hints for the bootcamp

## Capture plain HTTP (Beginner lab)

```bash
# Linux lo interface
sudo tcpdump -i lo -s 0 -w /tmp/raw-http.pcap port 8080
```

Wireshark display filter: `tcp.port == 8080`
Follow → TCP Stream เพื่อเห็น raw request/response แบบข้อความ

## Capture HTTPS (Intermediate / Expert)

TLS payload เข้ารหัส — ต้องมี key log เพื่อ decrypt ใน Wireshark

```bash
export SSLKEYLOGFILE=/tmp/sslkeys.log
# แล้วเปิด Chrome / Firefox / curl ที่รองรับ (build ของ curl ต้องใช้ OpenSSL และอ่าน env นี้)
curl --cacert ../../02-intermediate/src/certs/ca.cert.pem https://127.0.0.1:8443/
```

ใน Wireshark:

1. Preferences → Protocols → TLS
2. (Pre)-Master-Secret log filename = `/tmp/sslkeys.log`
3. Filter: `tls.handshake.type == 1` สำหรับ ClientHello
4. ดู ALPN ใน Handshake Extensions

## QUIC / HTTP/3

```bash
sudo tcpdump -i any -s 0 -w /tmp/quic.pcap udp port 443
```

Filter: `quic`
การ decrypt QUIC ซับซ้อนกว่า — ใช้ SSLKEYLOGFILE เช่นกันใน stack ที่รองรับ

## สิ่งที่ควรมองใน ClientHello

- Supported Versions (TLS 1.3)
- Cipher Suites
- ALPN (`h2`, `http/1.1`)
- Server Name Indication (SNI)
- Key Share (ECDHE)

## Ethics

จับ packet ได้เฉพาะ traffic ที่คุณมีสิทธิ์ — lab บน localhost หรือเครื่องที่ได้รับอนุญาต
