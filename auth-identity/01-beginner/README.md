# Level 1 — Beginner: Auth Foundations & Stateless vs Stateful Sessions

> **เป้าหมายระดับนี้:** แยก Authentication กับ Authorization ได้ชัดเจน ออกแบบ Session (Stateful) และ JWT (Stateless) ได้ถูกต้อง และเก็บรหัสผ่านด้วย hashing ที่ปลอดภัย

---

## สารบัญ

1. [ปรัชญาความปลอดภัยเบื้องต้น](#1-ปรัชญาความปลอดภัยเบื้องต้น)
2. [Authentication vs Authorization](#2-authentication-vs-authorization)
3. [Session Management Paradigms](#3-session-management-paradigms)
4. [Stateful Sessions: Cookies & Server Store](#4-stateful-sessions-cookies--server-store)
5. [Stateless Sessions: JWT Anatomy](#5-stateless-sessions-jwt-anatomy)
6. [Password Security: Hashing vs Encryption](#6-password-security-hashing-vs-encryption)
7. [ช่องโหว่ที่พบบ่อยในระดับนี้](#7-ช่องโหว่ที่พบบ่อยในระดับนี้)
8. [Best Practices](#8-best-practices)
9. [โครงสร้างโค้ดตัวอย่าง](#9-โครงสร้างโค้ดตัวอย่าง)

---

## 1. ปรัชญาความปลอดภัยเบื้องต้น

ระบบยืนยันตัวตนไม่ใช่แค่ “มีหน้า login” แต่เป็น **สัญญาความเชื่อถือ (trust contract)** ระหว่างผู้ใช้ แอป และ server

หลักคิดสำคัญ:

| หลักการ             | ความหมายในทางปฏิบัติ                              |
| ------------------- | ------------------------------------------------- |
| **Confidentiality** | รหัสผ่าน/token ไม่รั่วไหล                         |
| **Integrity**       | session/token ไม่ถูกแก้ไขโดยไม่ตรวจพบ             |
| **Availability**    | login/logout ใช้งานได้แม้มีโหลดสูง                |
| **Non-repudiation** | มี audit trail ว่าใครทำอะไรเมื่อไหร่ (ระดับถัดไป) |

**กฎทอง:** อย่าเก็บความลับในรูปแบบที่ reverse ได้ง่าย และอย่าเชื่อข้อมูลจาก client โดยไม่ตรวจสอบ

---

## 2. Authentication vs Authorization

### 2.1 Authentication (AuthN) — “คุณคือใคร?”

กระบวนการพิสูจน์ตัวตน เช่น:

- รหัสผ่าน + username/email
- Magic link / OTP
- Passkey / WebAuthn
- Federated login (Google, Keycloak) — เรียนละเอียดใน Expert

ผลลัพธ์ของ AuthN ที่ดีคือ **identity claim** ที่เชื่อถือได้ เช่น `userId`, `email`, `auth_time`

### 2.2 Authorization (AuthZ) — “คุณทำอะไรได้?”

กระบวนการตัดสินใจว่า identity นั้นมีสิทธิ์เข้าถึง resource/action หรือไม่ เช่น:

- อ่านเอกสารของตัวเองได้ แต่ลบเอกสารคนอื่นไม่ได้
- Role `admin` เข้า `/admin` ได้
- Scope `orders:read` เรียก API อ่านออเดอร์ได้

### 2.3 ขอบเขตที่มักสับสน

```
Login สำเร็จ   ≠ มีสิทธิ์ทำทุกอย่าง
มี JWT ที่ valid  ≠ มีสิทธิ์เข้าถึง object นั้น
เป็นเจ้าของ session ≠ เป็นเจ้าของ resource
```

| สถานการณ์                           | AuthN        | AuthZ            |
| ----------------------------------- | ------------ | ---------------- |
| ใส่รหัสผ่านผิด                      | ล้มเหลว      | ยังไม่ถึงขั้นนี้ |
| Login สำเร็จ แต่เรียก `/admin`      | ผ่าน         | ปฏิเสธ (403)     |
| Token หมดอายุ                       | ปฏิเสธ (401) | ยังไม่ถึงขั้นนี้ |
| Token ถูกต้อง แต่ดู order ของคนอื่น | ผ่าน         | ปฏิเสธ (IDOR)    |

**HTTP Status ที่ควรแยก:**

- **401 Unauthorized** — ยังไม่ยืนยันตัวตน / token ไม่ valid (จริง ๆ คือ “unauthenticated”)
- **403 Forbidden** — ยืนยันตัวตนแล้ว แต่ไม่มีสิทธิ์

---

## 3. Session Management Paradigms

หลังจาก AuthN สำเร็จ ระบบต้อง “จำ” ว่า request ถัดไปมาจากคนเดียวกัน วิธีจำมี 2 กระบวนทัศน์หลัก:

```
┌──────────────────────┐  ┌──────────────────────┐
│ STATEFUL SESSION │  │ STATELESS (JWT) │
├──────────────────────┤  ├──────────────────────┤
│ Server เก็บ session │  │ Server ไม่เก็บ state │
│ Client เก็บ sessionId│  │ Client เก็บ token │
│ Lookup ทุก request │  │ Verify signature  │
│ Revoke ได้ทันที  │  │ Revoke ยากกว่า  │
│ Scale ต้องแชร์ store │  │ Scale ง่าย   │
└──────────────────────┘  └──────────────────────┘
```

ไม่มีคำตอบเดียวว่าอันไหนดีกว่า — เลือกตาม **threat model**, **scale**, และ **ความต้องการ revoke**

---

## 4. Stateful Sessions: Cookies & Server Store

### 4.1 กลไกการทำงาน

1. ผู้ใช้ login สำเร็จ
2. Server สร้าง `sessionId` แบบสุ่ม (cryptographically secure)
3. เก็บข้อมูล session ใน Redis/SQL: `{ userId, createdAt, ip, ua, ... }`
4. ส่ง `sessionId` กลับผ่าน **Cookie**
5. Request ถัดไป: อ่าน cookie → lookup store → ได้ identity

### 4.2 Cookie Attributes ที่ต้องตั้งให้ถูก

| Attribute             | ค่าแนะนำ                     | เหตุผล                                |
| --------------------- | ---------------------------- | ------------------------------------- |
| `HttpOnly`            | `true`                       | JS อ่าน cookie ไม่ได้ → ลดผลกระทบ XSS |
| `Secure`              | `true` (production)          | ส่งเฉพาะ HTTPS                        |
| `SameSite`            | `Strict` หรือ `Lax`          | ลด CSRF                               |
| `Path`                | `/` หรือเฉพาะ path ที่จำเป็น | จำกัดขอบเขต                           |
| `Max-Age` / `Expires` | สั้นพอสมควร + idle timeout   | ลดหน้าต่างโจมตี                       |
| `Domain`              | แคบที่สุด                    | ไม่แชร์ข้าม subdomain โดยไม่จำเป็น    |

**ตัวอย่างแนวคิด:**

```
Set-Cookie: sid=abc123; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=3600
```

### 4.3 Session Store

| Store        | ข้อดี                      | ข้อเสีย                       |
| ------------ | -------------------------- | ----------------------------- |
| Memory (Map) | ง่ายสำหรับ demo            | ไม่ทน restart / ไม่ scale     |
| Redis        | เร็ว, TTL ในตัว, scale ได้ | ต้องดูแล infra                |
| SQL          | อยู่กับข้อมูลธุรกิจ        | ช้ากว่า Redis ถ้า traffic สูง |

### 4.4 ช่องโหว่ของ Stateful Session

| ช่องโหว่               | คำอธิบาย                                               | การป้องกัน                             |
| ---------------------- | ------------------------------------------------------ | -------------------------------------- |
| **Session Fixation**   | Attacker บังคับให้ victim ใช้ sessionId ที่รู้ล่วงหน้า | หมุน `sessionId` ใหม่หลัง login สำเร็จ |
| **Session Hijacking**  | ขโมย cookie ผ่าน XSS / network                         | HttpOnly + Secure + HTTPS + short TTL  |
| **CSRF**               | browser ส่ง cookie อัตโนมัติไปยังไซต์ที่ถูกหลอก        | SameSite + CSRF token                  |
| **Session Prediction** | sessionId เดาได้                                       | ใช้ CSPRNG (`crypto.randomBytes`)      |

---

## 5. Stateless Sessions: JWT Anatomy

### 5.1 JWT คืออะไร?

JSON Web Token เป็นโครงสร้าง 3 ส่วนคั่นด้วย `.`:

```
header.payload.signature
```

แต่ละส่วนเป็น Base64URL:

```jsonc
// Header
{ "alg": "HS256", "typ": "JWT" }

// Payload (claims)
{
 "sub": "user-42",
 "email": "alice@example.com",
 "iat": 1710000000,
 "exp": 1710003600
}

// Signature = HMACSHA256(
// base64url(header) + "." + base64url(payload),
// secret
// )
```

### 5.2 Symmetric Signing (HS256)

- ใช้ **shared secret** เดียวกันในการ sign และ verify
- เหมาะกับระบบ monolith / internal services ที่แชร์ secret ได้ปลอดภัย
- **ข้อเสีย:** ทุก service ที่ verify ได้ก็ forge token ได้ด้วย → secret ต้องปกป้องสูงมาก

> ในระดับ Expert จะเจอ **asymmetric** (RS256/ES256) ที่ IdP ถือ private key และ API ใช้ public JWKS

### 5.3 Claims ที่ควรรู้จัก

| Claim | ความหมาย                      |
| ----- | ----------------------------- |
| `sub` | Subject — มักเป็น user id     |
| `iat` | Issued at                     |
| `exp` | Expiration                    |
| `nbf` | Not before                    |
| `iss` | Issuer                        |
| `aud` | Audience                      |
| `jti` | JWT ID — ใช้ revoke/blacklist |

### 5.4 ข้อจำกัดสำคัญของ JWT

1. **Payload ไม่เข้ารหัส** — ใครก็ decode อ่านได้ (อย่าใส่รหัสผ่าน / PII อ่อนไหวเกินจำเป็น)
2. **Revoke ยาก** — token ที่ยังไม่หมดอายุยัง valid จนกว่าจะมี blacklist / version check
3. **ขนาดใหญ่กว่า session id** — ส่งทุก request

---

## 6. Password Security: Hashing vs Encryption

### 6.1 ทำไมห้ามเก็บ plaintext / reversible encryption

| วิธี                      | Reverse ได้?           | ใช้เก็บ password?                              |
| ------------------------- | ---------------------- | ---------------------------------------------- |
| Plaintext                 | ใช่                    | **ห้ามเด็ดขาด**                                |
| Encryption (AES)          | ใช่ (ถ้ามี key)        | **ไม่แนะนำ** — ถ้า key รั่ว รหัสผ่านทั้งหมดแตก |
| Hashing (one-way)         | ไม่                    | **ถูกต้อง**                                    |
| Hashing + Salt + Slow KDF | ไม่ + ต้าน brute-force | **มาตรฐานอุตสาหกรรม**                          |

### 6.2 Hashing ที่ “ช้าโดยตั้งใจ”

algorithm อย่าง **bcrypt**, **Argon2**, **scrypt** ออกแบบให้ช้าและใช้หน่วยความจำ เพื่อต้าน brute-force / rainbow table

**bcrypt**

- ใช้ Salt ในตัวอัตโนมัติ
- Cost factor (work factor) เช่น `12` = 2^12 rounds
- จำกัดความยาว input ~72 bytes → ควร pre-hash ด้วย SHA-256 ถ้าต้องการรับ passphrase ยาวมาก

**Argon2id** (แนะนำสำหรับระบบใหม่)

- ชนะ Password Hashing Competition
- ปรับได้ทั้ง time cost, memory cost, parallelism
- ต้าน side-channel และ GPU cracking ได้ดีกว่า

### 6.3 Salt คืออะไร?

Salt คือค่าสุ่มต่อรหัสผ่าน เพื่อให้:

- hash ของรหัสผ่านเดียวกันไม่เหมือนกัน
- rainbow table ใช้ไม่ได้

```
hash = bcrypt(password, salt) // salt ถูกฝังใน output string ของ bcrypt
```

### 6.4 Metrics ที่แนะนำ (แนวทาง 2024–2026)

| Algorithm | parameter เริ่มต้นที่สมเหตุสมผล                     |
| --------- | --------------------------------------------------- |
| bcrypt    | cost ≥ 12 (ปรับตาม latency ที่ยอมรับได้ ~200–500ms) |
| Argon2id  | memory ≥ 19–64 MiB, iterations ≥ 2–3, parallelism 1 |

วัดบนเครื่อง production-like แล้วเลือกค่าที่ช้าพอแต่ไม่ทำลาย UX

---

## 7. ช่องโหว่ที่พบบ่อยในระดับนี้

### 7.1 Timing attacks ตอนเปรียบเทียบ secret

ใช้ constant-time compare (`crypto.timingSafeEqual`) เมื่อเปรียบเทียบ token/hash ที่ sensitive

### 7.2 User enumeration

ข้อความ error แบบ `"email ไม่มีในระบบ"` vs `"รหัสผ่านผิด"` ช่วย attacker สำรวจบัญชี
→ ใช้ข้อความกลาง ๆ: `"อีเมลหรือรหัสผ่านไม่ถูกต้อง"`

### 7.3 Insecure JWT secret

- secret สั้น / เดาได้ / commit ใน git
- ใช้ `none` algorithm หรือไม่ validate `alg`

### 7.4 Cookie ไม่ตั้ง HttpOnly/Secure

XSS ขโมย session ได้ทันที

---

## 8. Best Practices

1. **แยก AuthN กับ AuthZ ในโค้ดและใน HTTP status**
2. **หมุน session id หลัง login** (anti-fixation)
3. **ตั้ง Cookie: HttpOnly + Secure + SameSite**
4. **JWT ต้องมี `exp` และ secret ที่แข็งแรง** (อย่างน้อย 32+ bytes สุ่ม)
5. **อย่าใส่ข้อมูลลับใน JWT payload**
6. **Hash รหัสผ่านด้วย bcrypt/Argon2 เท่านั้น — ห้าม MD5/SHA1**
7. **Rate-limit endpoint login** เพื่อต้าน brute-force
8. **ใช้ HTTPS ทุกที่** ใน production
9. **Log เหตุการณ์ auth** (สำเร็จ/ล้มเหลว) โดยไม่ log รหัสผ่าน
10. **ทดสอบ threat model:** XSS → cookie theft, CSRF → state-changing requests

---

## 9. โครงสร้างโค้ดตัวอย่าง

```
01-beginner/
├── README.md     ← คุณอยู่ที่นี่
├── LAB.md
├── package.json    ← (ใช้ root package ของ bootcamp)
└── src/
 ├── index.ts    ← demo server รวมทุก module
 ├── auth/
 │ ├── password.ts  ← bcrypt + argon2 helpers
 │ ├── session-store.ts ← in-memory / Redis-like session store
 │ └── jwt.ts   ← HS256 issue / verify / decode
 ├── middleware/
 │ ├── require-session.ts
 │ └── require-jwt.ts
 └── utils/
  ├── crypto.ts   ← CSPRNG, timingSafeEqual
  └── cookies.ts  ← cookie serialize helpers
```

### รันตัวอย่าง

```bash
cd auth-identity-bootcamp
npm install
npm run beginner:demo
```

ลองเรียก:

```bash
# สมัคร + login แบบ session
curl -c cookies.txt -X POST http://localhost:3001/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"alice@example.com","password":"Str0ng!Pass"}'

curl -c cookies.txt -b cookies.txt -X POST http://localhost:3001/login/session \
  -H 'Content-Type: application/json' \
  -d '{"email":"alice@example.com","password":"Str0ng!Pass"}'

curl -b cookies.txt http://localhost:3001/me/session

# login แบบ JWT
curl -X POST http://localhost:3001/login/jwt \
  -H 'Content-Type: application/json' \
  -d '{"email":"alice@example.com","password":"Str0ng!Pass"}'
```

---

## สิ่งที่ต้องพกไประดับ Intermediate

เมื่อจบระดับนี้ คุณควรอธิบายได้ว่า:

- ทำไม Access Token ควรสั้น และทำไมต้องมี Refresh Token
- ทำไม JWT อย่างเดียวไม่พอสำหรับ revocation
- ทำไม 401 กับ 403 ต้องแยก และ middleware ควรอยู่ตรงไหนใน pipeline
