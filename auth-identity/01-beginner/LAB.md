# Lab — Beginner: ออกแบบระบบล็อกอินที่ปลอดภัย

> **คำแนะนำ:** ทำด้วยตัวเองก่อนเปิดเฉลย
> โฟกัสที่ threat model ไม่ใช่แค่ “ให้ login ผ่าน”

---

## สถานการณ์จำลอง

คุณได้รับมอบหมายให้สร้างระบบ login ของ **ร้านค้าออนไลน์ขนาดกลาง “ShopSecure”**

ข้อกำหนดจากทีม Security:

1. ผู้ใช้สมัครด้วย email + password
2. รองรับทั้ง **Session Cookie** (เว็บ) และ **JWT** (mobile API)
3. ต้องต้าน **Session Hijacking** และ **Session Fixation**
4. รหัสผ่านต้องไม่สามารถ reverse ได้แม้ DB รั่ว
5. Error message ต้องไม่ช่วย user enumeration

---

## Lab 1.1 — Password Hashing Pipeline

### โจทย์

สร้าง module `password.ts` ที่:

- `hashPassword(plain: string): Promise<string>`
- `verifyPassword(plain: string, hash: string): Promise<boolean>`
- ใช้ bcrypt cost ≥ 12 **หรือ** Argon2id
- ห้ามใช้ MD5 / SHA1 / SHA256 เปล่า ๆ เป็น password hash

### เกณฑ์ผ่าน

- [ ] Hash ของรหัสผ่านเดียวกันสองครั้งได้คนละค่า (salt ต่างกัน)
- [ ] Verify ถูกต้องกับรหัสผ่านจริง
- [ ] Verify ผิดกับรหัสผ่านปลอม

### คำใบ้

ดู `src/auth/password.ts` เป็นแนวทาง แต่ลองเขียนใหม่ใน folder `lab/your-solution/`

---

## Lab 1.2 — Secure Session Login

### โจทย์

ออกแบบ flow:

```
POST /register
POST /login/session → Set-Cookie
POST /logout/session → ลบ session + เคลียร์ cookie
GET /me/session  → คืนข้อมูล user จาก session store
```

ข้อบังคับความปลอดภัย:

1. `sessionId` ต้องมาจาก CSPRNG (≥ 32 bytes)
2. หลัง login สำเร็จ **ต้องหมุน session id ใหม่** ถ้ามี sid เก่า (anti-fixation)
3. Cookie: `HttpOnly`, `SameSite=Lax`, `Secure` เมื่อ `NODE_ENV=production`
4. Idle timeout หรือ absolute timeout อย่างน้อยหนึ่งอย่าง

### สถานการณ์โจมตีที่ต้องกันได้

**Attack A — Session Fixation**

1. Attacker สร้าง session ว่าง แล้วหลอกให้ victim login ทับ session นั้น
2. ถ้าไม่หมุน session id → attacker ใช้ sid เดิมเข้าได้

**Attack B — XSS Cookie Theft**

1. ถ้า cookie ไม่มี `HttpOnly` → script ขโมย `document.cookie` ได้

### เกณฑ์ผ่าน

- [ ] Login แล้วมี cookie ที่ตั้ง attribute ถูกต้อง
- [ ] Logout แล้ว `/me/session` ได้ 401
- [ ] อธิบายได้ว่า anti-fixation ทำงานตรงจุดไหนในโค้ด

---

## Lab 1.3 — JWT Issue & Verify (HS256)

### โจทย์

สร้าง:

```
POST /login/jwt → { accessToken }
GET /me/jwt  → ต้องส่ง Authorization: Bearer <token>
```

ข้อบังคับ:

1. Payload มีอย่างน้อย `sub`, `iat`, `exp`
2. อายุ token ≤ 15 นาที สำหรับ lab นี้
3. Reject token ที่แก้ payload แล้ว sign ไม่ตรง
4. Reject token หมดอายุ
5. ห้ามเชื่อ `alg` จาก header แบบมืด ๆ (library ที่ดีจะบังคับ algorithm)

### เกณฑ์ผ่าน

- [ ] Token ที่ถูกต้องเข้า `/me/jwt` ได้
- [ ] Token ที่ถูกแก้แม้ 1 ตัวอักษร → 401
- [ ] Decode อย่างเดียว **ไม่** ถือว่า authentic

---

## Lab 1.4 — แก้ช่องโหว่ Session Hijacking (สถานการณ์จริง)

### เหตุการณ์

ทีม SOC พบว่าพนักงานถูก phishing แล้วมี script XSS ฝังในหน้าเก่าของระบบ
Cookie session ถูกขโมย และ attacker ใช้ session นั้นสั่งซื้อของในบัญชีเหยื่อ

### งานของคุณ

ออกแบบและ implement **อย่างน้อย 3 ชั้นป้องกัน** จากรายการนี้:

| ชั้น             | ตัวอย่าง                                                        |
| ---------------- | --------------------------------------------------------------- |
| Cookie hardening | HttpOnly, Secure, SameSite                                      |
| Binding          | ผูก session กับ hash(User-Agent) หรือ IP (ระวัง false positive) |
| Detection        | แจ้งเตือนเมื่อ IP/UA เปลี่ยนกะทันหัน                            |
| Containment      | absolute session timeout + re-auth สำหรับ action อ่อนไหว        |
| XSS reduction    | CSP, escape output (นอกขอบเขต lab แต่ควรระบุในรายงาน)           |

ส่งมอบ:

1. โค้ดที่แก้ใน session middleware
2. เอกสารสั้น ๆ อธิบาย residual risk (สิ่งที่ยังเหลืออยู่)

---

## เฉลย — วิธีคิดและโครงสร้าง

### วิธีคิดหลัก

1. **Threat first:** ระบุ attacker capability ก่อนเลือก control
2. **Defense in depth:** cookie flag อย่างเดียวไม่พอ ต้องมี timeout + rotation
3. **Fail secure:** session หาไม่เจอ / ไม่ตรง binding → 401 ทันที
4. **อย่า over-bind IP** ใน mobile network ที่ IP เปลี่ยนบ่อย — ใช้เป็น signal ไม่ใช่ hard fail เสมอไป

### โครงสร้างไฟล์แนะนำสำหรับเฉลย

```
01-beginner/lab/solution/
├── password.ts
├── session-auth.ts
├── jwt-auth.ts
├── hijacking-mitigations.ts
└── NOTES.md
```

### script เฉลยสำคัญ

#### 1) Password hashing (bcrypt)

```typescript
import bcrypt from 'bcrypt';

const COST = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, COST);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
```

#### 2) Anti-fixation — หมุน session หลัง login

```typescript
async function loginWithSession(req, res, user) {
  const oldSid = req.cookies?.sid;
  if (oldSid) {
    await sessionStore.destroy(oldSid);
  }

  const sid = randomSessionId(); // crypto.randomBytes(32).toString('base64url')
  await sessionStore.create(sid, {
    userId: user.id,
    uaHash: hashUa(req.headers['user-agent']),
    createdAt: Date.now(),
  });

  res.setHeader(
    'Set-Cookie',
    serializeCookie('sid', sid, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'Lax',
      path: '/',
      maxAge: 60 * 60,
    }),
  );
}
```

#### 3) Session hijacking mitigations

```typescript
export function assertSessionBinding(session, req): void {
  const currentUa = hashUa(req.headers['user-agent']);
  if (session.uaHash && session.uaHash !== currentUa) {
    // ทางเลือก: destroy session + force re-login
    throw Object.assign(new Error('Session binding mismatch'), { status: 401 });
  }
}
```

#### 4) JWT verify ที่บังคับ algorithm

```typescript
import jwt from 'jsonwebtoken';

export function verifyAccessToken(token: string) {
  return jwt.verify(token, process.env.JWT_SECRET!, {
    algorithms: ['HS256'], // ห้ามปล่อยให้ lib เดา
    maxAge: '15m',
  });
}
```

#### 5) ข้อความ error กลาง ๆ (anti-enumeration)

```typescript
res.status(401).json({ error: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' });
```

### เฉลย Lab 1.4 — รายงาน residual risk (ตัวอย่าง)

แม้จะตั้ง HttpOnly + UA binding + short TTL แล้ว ยังเหลือความเสี่ยง:

- XSS ยังโจมตีผู้ใช้ได้ในลักษณะอื่น (เช่น CSRF ถ้า SameSite อ่อน / action ไม่มี CSRF token)
- Attacker ที่ขโมย cookie **ก่อน** ที่ binding จะจับได้ ยังใช้ได้จนกว่า session หมดอายุ
- ดังนั้นต้องมี **CSP**, **input sanitization**, และ **step-up auth** สำหรับการโอนเงิน/เปลี่ยนอีเมล

---

## Checklist ส่งงาน

- [ ] Lab 1.1–1.3 ผ่านเกณฑ์
- [ ] Lab 1.4 มี ≥ 3 ชั้นป้องกัน + ระบุ residual risk
- [ ] ไม่มีรหัสผ่าน / JWT secret แข็งในโค้ด (ใช้ env)
- [ ] อธิบายความต่าง 401 vs 403 ได้ด้วยคำพูดตัวเอง

เมื่อพร้อมแล้วไปต่อที่ [`../02-intermediate/`](../02-intermediate/)
