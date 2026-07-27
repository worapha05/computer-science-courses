# Lab — Level 2 Intermediate (HTTPS, TLS Handshake, Certificates, Security Headers)

ทำในเครื่องตัวเองเท่านั้น ใบรับรองจาก `generate-certs.sh` เป็น self-signed สำหรับ lab

---

## Lab 2.1 — สร้าง Certificate Chain และยืนยันด้วย OpenSSL

### สถานการณ์

Dev ส่ง `server.crt` มาให้ แต่บนมือถือขึ้น "Certificate Authority Invalid" ส่วนบนเครื่อง dev ที่ติดตั้ง root เองเปิดได้

### งานที่ต้องทำ

```bash
cd 02-intermediate/src/certs
chmod +x generate-certs.sh
./generate-certs.sh

openssl verify -CAfile ca.cert.pem server.cert.pem
openssl x509 -in server.cert.pem -noout -text | less
# หา Subject Alternative Name
```

ตอบคำถาม:

1. ทำไมต้องมี intermediate/root ใน trust path?
2. ความต่างระหว่าง `server.cert.pem` กับ `fullchain.pem` คืออะไร?
3. ถ้าส่งแค่ leaf โดยไม่มี chain client จะล้มเหลวเมื่อไหร่?

### โครงสร้างไฟล์ที่คาดหวัง

```
02-intermediate/src/certs/
 ca.cert.pem
 ca.key.pem
 server.cert.pem
 server.key.pem
 fullchain.pem
 wrong-san.cert.pem
 wrong-san.key.pem
labs/lab2-1/notes.md
```

### เฉลย — วิธีคิด

1. Browser เชื่อ **Root** ใน trust store — leaf ถูกลงนามโดย CA (หรือ intermediate ที่ถูก root ลงนาม) ถ้าไม่มีโซ่ที่ต่อถึง root → `AUTHORITY_INVALID`
2. `server.cert.pem` = leaf; `fullchain.pem` = leaf + CA ที่ออกใบ (ใน lab คือ root) — server ควรเสิร์ฟ fullchain
3. ล้มเมื่อ client ไม่มี intermediate ใน cache และ server ไม่ส่งมาให้ — พบบ่อยเมื่อตั้ง `ssl_certificate` ชี้แค่ leaf

---

## Lab 2.2 — จำลองและแก้ Certificate Errors

### สถานการณ์จำลอง 3 เคส

| เคส | อาการ                                  | สาเหตุที่ซ่อนอยู่                         |
| --- | -------------------------------------- | ----------------------------------------- |
| A   | `CURLE_SSL_CACERT` / Authority Invalid | ใช้ self-signed โดยไม่ส่ง `--cacert`      |
| B   | Hostname mismatch                      | ใช้ใบ `wrong-san` กับ `https://127.0.0.1` |
| C   | หมดอายุ / วันที่ผิด                    | นาฬิการะบบเพี้ยน หรือใบหมดอายุ            |

### งานที่ต้องทำ

```bash
cd 02-intermediate/src
./certs/generate-certs.sh
node https-server.js
```

**เคส A — ไม่ trust CA:**

```bash
curl -v https://127.0.0.1:8443/                            # ควร fail
curl -v --cacert certs/ca.cert.pem https://127.0.0.1:8443/ # ควร OK
```

**เคส B — wrong SAN:** แก้ `https-server.js` ชั่วคราวให้อ่าน `wrong-san.*.pem` หรือรัน one-liner:

```bash
node -e "
const https=require('https'),fs=require('fs');
https.createServer({
 key:fs.readFileSync('certs/wrong-san.key.pem'),
 cert:fs.readFileSync('certs/wrong-san.cert.pem')
},(q,s)=>s.end('ok')).listen(8444,'127.0.0.1',()=>console.log('8444'));
"
# อีก terminal:
curl -vk --cacert certs/ca.cert.pem https://127.0.0.1:8444/
# แม้ -k จะข้าม verify บางส่วน แต่ลองโดยไม่ -k เพื่อเห็น mismatch
curl -v --cacert certs/ca.cert.pem https://127.0.0.1:8444/
```

**เคส C:** อธิบายว่าต้องตรวจ `notBefore` / `notAfter` และ NTP

```bash
openssl x509 -in certs/server.cert.pem -noout -dates
```

### เฉลย

| เคส | วิธีแก้ที่ถูก                                                                                                                                       |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| A   | ใน lab: ใช้ `--cacert ca.cert.pem` หรือติดตั้ง lab CA ใน trust store ของเครื่องทดลองเท่านั้น ใน production: ใช้ใบจาก public CA (เช่น Let's Encrypt) |
| B   | ออกใบใหม่ให้ SAN มี `DNS:localhost` และ `IP:127.0.0.1` (หรือชื่อที่ client เรียกจริง) — **อย่า** ปิด verify ใน production                           |
| C   | renew ใบ + ตั้ง NTP; ตรวจด้วย `openssl x509 -dates`                                                                                                 |

script รวบรวมอาการ:

```bash
#!/usr/bin/env bash
# labs/lab2-2/repro-cert-errors.sh
set -euo pipefail
cd "$(dirname "$0")/../../src"
echo "A) no cacert:"
curl -sS -o /dev/null -w "%{http_code} err=%{errormsg}\n" https://127.0.0.1:8443/ || true
echo "A) with cacert:"
curl -sS --cacert certs/ca.cert.pem -o /dev/null -w "%{http_code}\n" https://127.0.0.1:8443/
```

---

## Lab 2.3 — วิเคราะห์ Handshake ด้วย OpenSSL และเปรียบเทียบ TLS 1.2 / 1.3

### งานที่ต้องทำ

```bash
cd 02-intermediate/src
chmod +x tls-inspect.sh
./tls-inspect.sh 127.0.0.1:8443
```

บังคับ version:

```bash
curl -v --cacert certs/ca.cert.pem --tlsv1.2 --tls-max 1.2 https://127.0.0.1:8443/tls
curl -v --cacert certs/ca.cert.pem --tlsv1.3 --tls-max 1.3 https://127.0.0.1:8443/tls
```

ตอบ:

1. TLS 1.3 ลด round-trip อย่างไรเมื่อเทียบกับ 1.2?
2. 0-RTT อันตรายกับ POST ชำระเงินอย่างไร?
3. Forward Secrecy ได้จากกลไกใด?

### เฉลย

1. TLS 1.3 รวม key share ใน ClientHello และส่ง Certificate/Finished เร็วขึ้น → application data ได้หลัง **1-RTT** (1.2 มักต้อง 2-RTT)
2. Early data ถูก replay ได้ — ผู้โจมตีที่จับ packet อาจส่งซ้ำแล้วให้ server ประมวลผล POST ซ้ำ
3. **Ephemeral Diffie-Hellman (ECDHE)** สร้าง shared secret ต่อ session ที่ไม่ถูก derive จาก long-term cert private key อย่างเดียว

---

## Lab 2.4 — Security Headers Audit

### สถานการณ์

เพนต์ test รายงานว่าเว็บถูกฝังใน iframe คนละ domain ได้ และยังไม่มี HSTS

### งานที่ต้องทำ

```bash
python3 security-headers-server.py
curl -sD - http://127.0.0.1:8082/ -o /dev/null
```

และบน HTTPS server:

```bash
curl -sD - --cacert certs/ca.cert.pem https://127.0.0.1:8443/ -o /dev/null
```

ตรวจว่ามีอย่างน้อย:

- `Strict-Transport-Security`
- `Content-Security-Policy` (หรือ Report-Only)
- `X-Frame-Options` หรือ CSP `frame-ancestors`
- cookie จาก `/login` มี `Secure; HttpOnly; SameSite`

### Checklist เฉลย

```bash
#!/usr/bin/env bash
# labs/lab2-4/audit-headers.sh
set -euo pipefail
URL="${1:-http://127.0.0.1:8082/}"
HDR=$(mktemp)
trap 'rm -f "$HDR"' EXIT
curl -sD "$HDR" -o /dev/null "$URL"
for h in Strict-Transport-Security Content-Security-Policy X-Frame-Options X-Content-Type-Options; do
  grep -qi "^$h:" "$HDR" && echo "OK $h" || echo "MISS $h"
done
```

**SameSite:** `Lax` เหมาะเป็นค่าเริ่มต้นของ session; ใช้ `None; Secure` เฉพาะเมื่อต้องการ cross-site cookie จริงๆ

**HSTS บน localhost lab:** `max-age` สั้นๆ (เช่น 300) เพื่อกัน browser จำนาน — บน production ค่อยใช้ค่าปี+ และคิดเรื่อง preload ให้รอบคอบ

---

## Lab 2.5 — NGINX TLS Config Review

### งานที่ต้องทำ

1. อ่าน `nginx/tls-basic.conf` และ `nginx/security-headers.conf`
2. แก้ path ของ `ssl_certificate` ให้ชี้ `fullchain.pem`
3. อธิบายว่าทำไมใช้ `fullchain` ไม่ใช่แค่ leaf
4. (ถ้ามี NGINX) ทดสอบ `nginx -t` หลังแก้ path

### เฉลยสั้นๆ

- `ssl_protocols TLSv1.2 TLSv1.3;` ตัดโปรโตคอลเก่า
- `ssl_certificate` ควรเป็น **full chain**
- `add_header ... always;` สำคัญเพราะ header ต้องติดแม้ response error
- redirect HTTP→HTTPS ก่อน แล้วค่อยขยาย HSTS `max-age`

---

## Checkpoint ก่อนขึ้น Expert

- [ ] สร้าง lab CA + leaf และ verify ด้วย OpenSSL ได้
- [ ] แยกอาการ Authority Invalid / Name Mismatch / Expired ได้
- [ ] อธิบาย TLS 1.2 vs 1.3 และความเสี่ยง 0-RTT ได้
- [ ] ตั้ง HSTS, CSP, XFO, SameSite ได้ทั้งในแอปและ NGINX snippet

ไปต่อที่ [`../03-expert/`](../03-expert/)
