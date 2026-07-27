# Level 2 — Intermediate: Cryptography, Common Vulnerabilities & Web Protection

> **เป้าหมายระดับนี้:** แยก Encryption / Hashing / Encoding ได้ถูกต้อง ใช้ AES และแนวคิด RSA อย่างเหมาะสม และป้องกันช่องโหว่ OWASP Top 10 เบื้องต้น (Injection, Broken Auth, Sensitive Data Exposure)

---

## สารบัญ

1. [ทำไม Cryptography ถึงสำคัญ](#1-ทำไม-cryptography-ถึงสำคัญ)
2. [Symmetric vs Asymmetric Cryptography](#2-symmetric-vs-asymmetric-cryptography)
3. [Data in Transit vs Data at Rest](#3-data-in-transit-vs-data-at-rest)
4. [Hashing vs Encoding vs Encryption](#4-hashing-vs-encoding-vs-encryption)
5. [Introduction to OWASP Top 10](#5-introduction-to-owasp-top-10)
6. [Injection: SQLi และ XSS](#6-injection-sqli-และ-xss)
7. [Broken Authentication & Sensitive Data Exposure](#7-broken-authentication--sensitive-data-exposure)
8. [Best Practices](#8-best-practices)
9. [โครงสร้างโค้ดตัวอย่าง](#9-โครงสร้างโค้ดตัวอย่าง)

---

## 1. ทำไม Cryptography ถึงสำคัญ

Cryptography คือเครื่องมือหลักในการปกป้อง **Confidentiality** และ **Integrity**
แต่ถ้าเลือกกลไกผิด (เช่น ใช้ Base64 เป็น "encryption" หรือใช้ SHA-256 เก็บรหัสผ่านเปล่า ๆ) จะได้ความปลอดภัยหลอกตา

| คำถามก่อนเลือกกลไก                                  | คำตอบที่ต้องการ                  |
| --------------------------------------------------- | -------------------------------- |
| ต้องการซ่อนความหมายจากคนอื่นหรือไม่?                | Encryption                       |
| ต้องการตรวจว่าข้อมูลถูกแก้หรือไม่?                  | Hash / HMAC / Signature          |
| ต้องการแปลงรูปแบบเพื่อขนส่งเท่านั้นหรือไม่?         | Encoding                         |
| ต้องการเก็บความลับที่ต้อง verify แต่ไม่ต้องถอดกลับ? | Password hashing (bcrypt/Argon2) |

---

## 2. Symmetric vs Asymmetric Cryptography

### 2.1 Symmetric (กุญแจร่วม) — AES

- ใช้ **คีย์เดียว** ทั้งเข้ารหัสและถอดรหัส
- เร็ว เหมาะกับข้อมูลปริมาณมาก (ไฟล์, DB column, disk)
- ปัญหาหลัก: **จะแชร์คีย์อย่างไรให้ปลอดภัย**

มาตรฐานที่แนะนำในระดับเรียนนี้: **AES-256-GCM** (มีทั้ง confidentiality + integrity ผ่าน auth tag)

```
Plaintext + Key ──AES-GCM──► Ciphertext + IV + AuthTag
Ciphertext + IV + AuthTag + Key ──AES-GCM──► Plaintext (หรือ fail ถ้าถูกแก้)
```

### 2.2 Asymmetric (กุญแจคู่) — RSA / ECC

- มี **Public Key** (แจกได้) และ **Private Key** (เก็บลับ)
- เหมาะกับ: แลกคีย์, digital signature, TLS handshake
- ช้ากว่า symmetric มาก → มักใช้เข้ารหัส **คีย์สั้น ๆ** ไม่ใช่ไฟล์ใหญ่

```
ผู้ส่งใช้ Public Key ของผู้รับ ──► Ciphertext
ผู้รับใช้ Private Key ของตัวเอง ──► Plaintext
```

### 2.3 เปรียบเทียบสั้น ๆ

| มิติ             | AES (Symmetric)      | RSA (Asymmetric)            |
| ---------------- | -------------------- | --------------------------- |
| จำนวนคีย์        | 1                    | 2 (public/private)          |
| ความเร็ว         | สูง                  | ต่ำ                         |
| ใช้กับข้อมูลใหญ่ | เหมาะ                | ไม่เหมาะโดยตรง              |
| ใช้แลกคีย์       | ต้องมีช่องทางปลอดภัย | เหมาะ                       |
| ตัวอย่างจริง     | encrypt DB field     | TLS, signed JWT (RSA/ECDSA) |

**แนวปฏิบัติจริง (Hybrid Encryption):** ใช้ RSA/ECDH แลก AES key แล้วใช้ AES เข้ารหัสข้อมูลจริง

---

## 3. Data in Transit vs Data at Rest

| สถานะข้อมูล    | ความหมาย                  | Control หลัก                                          |
| -------------- | ------------------------- | ----------------------------------------------------- |
| **In Transit** | กำลังส่งผ่านเครือข่าย     | TLS 1.2+ (HTTPS), VPN, certificate pinning (บางเคส)   |
| **At Rest**    | เก็บบนดิสก์ / DB / backup | AES, disk encryption, KMS, key rotation               |
| **In Use**     | กำลังประมวลผลใน memory    | จำกัดสิทธิ์ process, confidential computing (ขั้นสูง) |

ข้อผิดพลาด classic:

- ใช้ HTTPS แล้วคิดว่า "ไม่ต้อง encrypt ที่ DB" → ถ้าดิสก์/backup รั่ว ข้อมูลยังอ่านได้
- Encrypt ที่ DB แล้วส่งผ่าน HTTP ล้วน → ระหว่างทางยังถูกดักได้ (และ metadata อื่น ๆ)

---

## 4. Hashing vs Encoding vs Encryption

### 4.1 Encoding

แปลงรูปแบบให้อ่าน/ส่งได้ — **ไม่ใช่ความปลอดภัย**

- Base64, URL encoding, Hex
- ใครก็ decode กลับได้

### 4.2 Hashing

function ทางเดียว (one-way) สำหรับตรวจสอบความถูกต้อง

- SHA-256, SHA-3
- เหมาะกับ: checksum ไฟล์, integrity ของ artifact
- **ไม่เหมาะ** กับการเก็บรหัสผ่านโดยตรง (ต้องใช้ bcrypt / Argon2 / scrypt ที่มี salt + cost)
- **ถอดกลับไม่ได้** (ในทางปฏิบัติ) แต่ถ้าค่าเดิมเดาง่าย อาจถูก rainbow table / brute-force

### 4.3 Encryption

ถอดกลับได้ด้วยคีย์ — สำหรับรักษาความลับ

```
Encoding   : "hello" → Base64 → "aGVsbG8="  (ใครก็กลับได้)
Hashing    : "hello" → SHA-256 → "2cf24d..." (กลับไม่ได้ / ตรวจ integrity)
Encryption : "hello" → AES+key → "gAAAA..."  (กลับได้ถ้ามี key)
```

| ใช้ทำอะไร             | เลือก                                             |
| --------------------- | ------------------------------------------------- |
| ส่ง binary ใน JSON    | Encoding (Base64)                                 |
| ตรวจไฟล์ถูกแก้หรือไม่ | Hashing (SHA-256)                                 |
| ซ่อนเลขบัตรใน DB      | Encryption (AES-GCM)                              |
| เก็บ password         | Password KDF (Argon2id / bcrypt) ไม่ใช่ SHA เปล่า |

---

## 5. Introduction to OWASP Top 10

[OWASP Top 10](https://owasp.org/www-project-top-ten/) คือรายการความเสี่ยงเว็บที่พบบ่อยและสร้างความเสียหายสูง
ในระดับนี้เจาะลึก 3 กลุ่มที่นักพัฒนาเจอบ่อย:

1. **Injection** (SQLi, XSS, Command Injection)
2. **Broken Authentication** (รวมถึง session / credential management ที่อ่อนแอ)
3. **Sensitive Data Exposure** / Cryptographic Failures

แนวคิดรวม: **อย่าเชื่อ input**, **อย่าเก็บความลับแบบอ่อน**, **ทำให้ fail แบบปลอดภัย**

---

## 6. Injection: SQLi และ XSS

### 6.1 SQL Injection

เกิดเมื่อนำ string จากผู้ใช้ไปต่อเข้า SQL โดยตรง

```sql
-- อันตราย
SELECT
  *
FROM
  users
WHERE
  email = '" + userInput + "';

-- ถ้า userInput = ' OR '1'='1 → ได้ข้อมูลทั้งตาราง
```

**แนวทางป้องกัน:**

1. **Parameterized queries / prepared statements** (อันดับหนึ่ง)
2. Allowlist ของ sort column / table name (ถ้าต้อง dynamic)
3. จำกัดสิทธิ์ DB user ของแอป (PoLP)
4. ไม่โชว์ SQL error ดิบให้ผู้ใช้

### 6.2 Cross-Site Scripting (XSS)

ฝัง script ในหน้าเว็บของเหยื่อ

| ประเภท        | ลักษณะ                                                      |
| ------------- | ----------------------------------------------------------- |
| Stored XSS    | เก็บ payload ใน DB แล้วเสิร์ฟให้คนอื่น                      |
| Reflected XSS | สะท้อนจาก query string ทันที                                |
| DOM XSS       | เกิดจาก JS ฝั่ง client ใส่ untrusted data ลง DOM ไม่ปลอดภัย |

**แนวทางป้องกัน:**

1. Context-aware output encoding / escaping
2. ใช้ framework ที่ escape โดย default
3. Content-Security-Policy (CSP)
4. HttpOnly cookie ลดผลกระทบเมื่อขโมย session

### 6.3 Input Sanitization

- **Validation** = ตรวจรูปแบบ/ขอบเขต (email, ความยาว, enum)
- **Sanitization** = ลบ/แปลงอักขระอันตรายตามบริบท
- **Parameterized query** สำคัญกว่า "พยายาม sanitize SQL ด้วยมือ"

กฎ: sanitize ตาม **context** (HTML ≠ URL ≠ SQL ≠ shell)

---

## 7. Broken Authentication & Sensitive Data Exposure

### Broken Authentication (แนวคิด)

- รหัสผ่านอ่อน / ไม่มี rate limit
- Session ไม่หมุนหลัง login
- Token ยาวเกินไปโดยไม่มี revoke
- Error message ที่ช่วย enumerate ผู้ใช้

### Sensitive Data Exposure / Cryptographic Failures

- ส่งรหัสผ่านหรือเลขบัตรผ่าน HTTP
- เก็บ secret ใน repo / log
- ใช้ MD5 / SHA1 สำหรับความปลอดภัย
- ใช้ AES-ECB หรือ IV คงที่
- Log ข้อมูล PII แบบ plaintext

**Checklist สั้น ๆ:**

- [ ] TLS ทุก endpoint ที่รับ credentials
- [ ] แยก secret ออกจากโค้ด (env / secret manager)
- [ ] Encrypt PII at rest เมื่อความเสี่ยงสูง
- [ ] Mask ข้อมูลใน log และ UI

---

## 8. Best Practices

1. ใช้ **AES-256-GCM** สำหรับ symmetric encryption พร้อม random IV ทุกครั้ง
2. เก็บคีย์ใน **KMS / secret manager** ไม่ hardcode
3. ใช้ **TLS** สำหรับ data in transit เสมอใน production
4. แยก Encoding / Hashing / Encryption ให้ถูกงาน
5. Password → **Argon2id หรือ bcrypt** ไม่ใช่ SHA-256 เปล่า
6. SQL → **parameterized queries เท่านั้น**
7. HTML output → escape / CSP
8. ลดข้อมูลที่เก็บ — ถ้าไม่ต้องเก็บเลขบัตรเต็ม ก็อย่าเก็บ
9. Key rotation และแผน revoke เมื่อคีย์รั่ว
10. ทดสอบด้วย test เชิงลบ (payload โจมตี) ใน staging ที่ได้รับอนุญาต

---

## 9. โครงสร้างโค้ดตัวอย่าง

```
02-intermediate/src/
├── index.ts
├── crypto/
│   ├── aes-gcm.ts         # AES-256-GCM encrypt/decrypt
│   └── rsa-hybrid.ts      # RSA wrap AES key (hybrid)
├── hashing/
│   └── hash-vs-encode.ts  # เปรียบเทียบ hash / encode / encrypt
├── sanitization/
│   └── sanitize.ts        # validation + HTML escape
└── injection/
    └── sql-safe.ts        # vulnerable vs parameterized pattern
```

### วิธีรัน

```bash
cd basic-security-concepts
npm install
npm run intermediate:demo
```

อ่านต่อ: [`LAB.md`](./LAB.md)
