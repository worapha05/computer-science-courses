# Level 2 — Intermediate: HTTPS Cryptography & The Secure Handshake

> เป้าหมาย: เข้าใจว่า HTTPS = HTTP บนช่องทางที่เข้ารหัสด้วย TLS อย่างไร ตั้งแต่กุญแจสมมาตร/อสมมาตร ไปจนถึง Certificate และ Security Headers

---

## สารบัญ

1. [Symmetric vs Asymmetric Encryption](#1-symmetric-vs-asymmetric-encryption)
2. [The TLS/SSL Handshake](#2-the-tlsssl-handshake)
3. [Digital Certificates & PKI](#3-digital-certificates--pki)
4. [Security Headers](#4-security-headers)
5. [Best Practices](#5-best-practices)
6. [ไฟล์ตัวอย่างใน `src/`](#6-ไฟล์ตัวอย่างใน-src)

---

## 1. Symmetric vs Asymmetric Encryption

### 1.1 Symmetric (กุญแจสมมาตร)

- Client และ Server ใช้ **กุญแจเดียวกัน** เข้ารหัสและถอดรหัส
- เร็วมาก — เหมาะกับ bulk data (เนื้อหา HTTP หลัง handshake)
- algorithm ที่ใช้บนเว็บสมัยใหม่: **AES-GCM**, ChaCha20-Poly1305
- ปัญหา: จะแชร์กุญแจลับผ่านเน็ตอย่างไรโดยไม่ถูกดัก?

### 1.2 Asymmetric (กุญแจอสมมาตร / Public Key Cryptography)

- มีคู่กุญแจ: **public key** (แจกได้) และ **private key** (เก็บลับ)
- ใครก็เข้ารหัสด้วย public key ได้ แต่ถอดได้เฉพาะเจ้าของ private key
- ใช้ลงนามดิจิทัล (sign ด้วย private, verify ด้วย public)
- algorithm classic: **RSA**, และบนเว็บสมัยใหม่เน้น **Elliptic Curve** (ECDSA, ECDHE)

### 1.3 Diffie–Hellman และบทบาทบนเว็บ

**Diffie–Hellman (DH / ECDHE)** ให้สองฝ่ายสร้าง **shared secret ร่วมกัน** โดยไม่ส่งกุญแจลับตรงๆ บนสาย

บน TLS:

1. Asymmetric / DH ใช้ช่วง **handshake** เพื่อตกลง session keys
2. Symmetric ใช้ช่วง **record layer** เข้ารหัส HTTP bytes จริง

```
[Handshake: asymmetric + DH] → ได้ traffic keys
[Application Data: AES-GCM] → HTTP Request/Response ที่เข้ารหัส
```

**Forward Secrecy:** ใช้ ephemeral DH (ECDHE) — แม้ private key ของ certificate ถูกขโมยภายหลัง ก็ถอด session เก่าจาก traffic capture ไม่ได้

---

## 2. The TLS/SSL Handshake

> ชื่อ "SSL" ยังถูกพูดถึงในชีวิตประจำวัน แต่โปรโตคอลที่ใช้งานจริงคือ **TLS** (SSL ถูกเลิกใช้แล้ว)

### 2.1 เป้าหมายของ Handshake

1. ตกลง version TLS และ cipher suite
2. ยืนยันตัวตน server (และอาจยืนยัน client) ผ่าน certificate
3. สร้าง shared secrets → derive keys สำหรับเข้ารหัส/MAC
4. เริ่มส่ง Application Data (HTTP)

### 2.2 TLS 1.2 (สรุปขั้นตอนหลัก)

```
Client           Server
 |            |
 |----------- ClientHello ---------------------->| versions, cipher list, random, extensions
 |<---------- ServerHello -----------------------| chosen cipher, random
 |<---------- Certificate -----------------------| server cert chain
 |<---------- ServerKeyExchange -----------------| DH params (ถ้าใช้ ECDHE)
 |<---------- ServerHelloDone -------------------|
 |            |
 |----------- ClientKeyExchange ---------------->| DH public / premaster
 |----------- ChangeCipherSpec ----------------->|
 |----------- Finished (encrypted) ------------->|
 |<---------- ChangeCipherSpec ------------------|
 |<---------- Finished --------------------------|
 |            |
 |=========== Application Data (HTTP) ==========|
```

- ใช้ **หลาย round-trip** ก่อนส่ง HTTP ได้
- Premaster secret + client/server random → master secret → key block

### 2.3 TLS 1.3 (สิ่งที่เปลี่ยน)

```
Client           Server
 |            |
 |-- ClientHello + key_share + signature_algs -->|
 |<---- ServerHello + key_share + EncryptedExt --|
 |<---- Certificate + CertVerify + Finished -----| (เข้ารหัสแล้วส่วนใหญ่)
 |------ Finished ------------------------------>|
 |======= Application Data =====================|
```

จุดเด่น:

| หัวข้อ                         | TLS 1.2               | TLS 1.3                             |
| ------------------------------ | --------------------- | ----------------------------------- |
| Round-trips ก่อนข้อมูล         | มัก 2-RTT             | **1-RTT** (และ 0-RTT ได้)           |
| Cipher legacy                  | รองรับชุดเก่าจำนวนมาก | ตัด RSA key transport, CBC, RC4 ฯลฯ |
| Forward Secrecy                | optional ตาม cipher   | **บังคับ** (ECDHE/DHE)              |
| ค่าที่เข้ารหัสหลัง ServerHello | น้อยกว่า              | มากขึ้น (ลดการรั่ว metadata)        |

### 2.4 0-RTT (Early Data)

- Client ที่เคยคุยกับ server มาก่อนสามารถส่งข้อมูล application พร้อม ClientHello แรกได้
- ลด latency สูงสุด แต่เสี่ยง **replay attack** — อย่าใช้ 0-RTT กับ request ที่มี side-effect (POST ชำระเงิน ฯลฯ)
- เหมาะกับ GET ที่ปลอดภัยและ idempotent

### 2.5 Session Keys Generation (ภาพรวม)

```
Shared secret (จาก ECDHE)
  ↓
HKDF / PRF (ขึ้นกับ version TLS)
  ↓
client_write_key, server_write_key, IV, ...
  ↓
AES-GCM / ChaCha20-Poly1305 ปกป้อง HTTP records
```

---

## 3. Digital Certificates & PKI

### 3.1 Public Key Infrastructure (PKI)

```
Root CA (อยู่ใน trust store ของ OS/Browser)
 └── Intermediate CA
   └── Leaf / End-entity Certificate (ของ example.com)
```

- **Certificate** ผูก domain (SAN) กับ public key และลงนามโดย CA
- Browser ตรวจ: ลายเซ็นโซ่, วันหมดอายุ, ชื่อ domain ตรงไหม, ถูก revoke หรือไม่

### 3.2 บทบาทของ CA และ Root Certificates

- **Root CA** ถูกฝังในระบบ (trusted anchors) — private key ออฟไลน์เข้มงวด
- **Intermediate** ออกใบจริงให้เว็บไซต์ — ลดความเสี่ยงถ้า leaf/intermediate ถูก compromise
- **Leaf cert** ต้องส่งพร้อม intermediate (certificate chain) — ขาด chain จะเจอ error บนบาง client

### 3.3 Let's Encrypt

- CA ที่ออกใบรับรองฟรีผ่านโปรโตคอล **ACME**
- ยืนยันการควบคุม domain ด้วย HTTP-01 หรือ DNS-01
- อายุใบสั้น (เดิม 90 วัน) → บังคับให้มีระบบ renew อัตโนมัติ (`certbot`, `acme.sh`, Caddy ฯลฯ)

```bash
# ตัวอย่างแนวคิด (อย่ารันบน production โดยไม่อ่านเอกสาร)
certbot certonly --webroot -w /var/www/html -d example.com
```

### 3.4 Certificate Errors ที่พบบ่อย

| อาการ                               | สาเหตุทั่วไป                       | แนวทางแก้                                                   |
| ----------------------------------- | ---------------------------------- | ----------------------------------------------------------- |
| `NET::ERR_CERT_AUTHORITY_INVALID`   | self-signed / CA ไม่ใน trust store | ใช้ใบจาก CA ที่เชื่อถือได้ หรือติดตั้ง root ใน lab เท่านั้น |
| `NET::ERR_CERT_COMMON_NAME_INVALID` | ชื่อ domain ไม่ตรง SAN             | ออกใบใหม่ให้มี SAN ถูกต้อง                                  |
| `NET::ERR_CERT_DATE_INVALID`        | หมดอายุ / นาฬิกาเครื่องเพี้ยน      | renew + ซิงก์เวลา NTP                                       |
| Incomplete chain                    | ส่งแค่ leaf ไม่มี intermediate     | ตั้ง `ssl_certificate` เป็น fullchain                       |
| Mixed Content                       | หน้า HTTPS โหลด HTTP resource      | เปลี่ยนเป็น HTTPS หรือ relative URL                         |

---

## 4. Security Headers

ส่งผ่าน HTTP Response หลัง TLS แล้ว — เสริมนโยบาย browser

### 4.1 HSTS (HTTP Strict Transport Security)

```http
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
```

- บังคับให้ browser ใช้ HTTPS เท่านั้นกับ domain นี้เป็นเวลา `max-age` วินาที
- กัน SSL stripping (ผู้โจมตีพยายามดาวน์เกรดเป็น HTTP)
- เปิด `preload` เมื่อพร้อมส่ง domain เข้า HSTS preload list เท่านั้น

### 4.2 CSP (Content Security Policy)

```http
Content-Security-Policy: default-src 'self'; script-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'
```

- จำกัดแหล่ง script/รูป/iframe → ลดผลกระทบ XSS
- เริ่มจาก `Content-Security-Policy-Report-Only` ใน production ก่อน enforce

### 4.3 X-Frame-Options และ frame-ancestors

```http
X-Frame-Options: DENY
```

- กัน clickjacking (ฝังหน้าคุณใน iframe คนละ origin)
- สมัยใหม่ใช้ CSP `frame-ancestors 'none'` ได้ละเอียดกว่า

### 4.4 SameSite Cookies

```http
Set-Cookie: session_id=...; Secure; HttpOnly; SameSite=Lax; Path=/
```

| ค่า      | พฤติกรรม                                     |
| -------- | -------------------------------------------- |
| `Strict` | ไม่ส่ง cookie ในทุก cross-site navigation    |
| `Lax`    | ส่งเมื่อ top-level GET จากไซต์อื่น (สมดุลดี) |
| `None`   | ส่งข้ามไซต์ได้ — **ต้องมี `Secure`**         |

บน HTTPS production: `Secure` + `HttpOnly` + `SameSite` เป็นชุดขั้นต่ำของ session cookie

### 4.5 หัวอื่นๆ ที่ควรรู้

```http
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: geolocation=(), camera=()
```

---

## 5. Best Practices

1. ปิด TLS 1.0/1.1 — ใช้ TLS 1.2+ และPrefer TLS 1.3
2. เลือก cipher ที่ forward-secret (ECDHE + AES-GCM / ChaCha20)
3. ส่ง **full chain** (leaf + intermediate) เสมอ
4. Automate renew (Let's Encrypt) และมอนิเตอร์วันหมดอายุ
5. Redirect HTTP → HTTPS แล้วค่อยเปิด HSTS เมื่อมั่นใจว่าทุก subdomain พร้อม
6. อย่าใช้ 0-RTT กับ non-idempotent requests
7. Session cookie: `Secure; HttpOnly; SameSite`
8. ทดสอบด้วย `openssl s_client`, SSL Labs, และ browser DevTools Security panel

---

## 6. ไฟล์ตัวอย่างใน `src/`

| ไฟล์                          | คำอธิบาย                                    |
| ----------------------------- | ------------------------------------------- |
| `certs/generate-certs.sh`     | สร้าง CA + leaf self-signed สำหรับ lab      |
| `https-server.js`             | HTTPS server (Node) พร้อม security headers  |
| `tls-inspect.sh`              | ตรวจ version TLS / certificate ด้วย OpenSSL |
| `security-headers-server.py`  | demo HSTS/CSP/XFO/SameSite                  |
| `nginx/tls-basic.conf`        | config NGINX TLS พื้นฐาน                    |
| `nginx/security-headers.conf` | snippet หัวความปลอดภัย                      |

ทำแบบฝึกใน [`LAB.md`](./LAB.md)
