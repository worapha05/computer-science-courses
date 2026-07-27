# Authentication & Authorization Bootcamp — Zero to Expert

bootcamp เรียนรู้ **Authentication, Authorization และ Federated Identity** แบบครบวงจร
เน้น **สถาปัตยกรรมความปลอดภัย, Token-based Security, มาตรฐานโปรโตคอล และ Enterprise Access Control**
จาก Foundations → Token Lifecycles / RBAC-ABAC → OAuth 2.0 / OIDC / Zero-Trust

---

## เป้าหมายของหลักสูตร

เมื่อจบหลักสูตรนี้ คุณจะสามารถ:

- แยกขอบเขต **Authentication (คุณคือใคร)** กับ **Authorization (คุณทำอะไรได้)** ได้อย่างชัดเจน
- ออกแบบ **Stateful Session** (Cookie + Redis) และ **Stateless JWT** พร้อมอธิบาย trade-off
- ใช้ **bcrypt / Argon2** hash รหัสผ่านอย่างปลอดภัย พร้อม Salt และ cost factor ที่เหมาะสม
- สร้างระบบ **Access / Refresh Token**, Token Rotation, Revocation / Blacklist
- Implement **RBAC** และ **ABAC** ใน middleware พร้อมป้องกัน IDOR, XSS, CSRF
- ออกแบบ **OAuth 2.0 + OIDC**, PKCE, SSO, MFA/TOTP และ Zero-Trust ที่ API Gateway

---

## โครงสร้างหลักสูตร

| Level            | folder                                   | หัวข้อหลัก                                             | เวลาแนะนำ   |
| ---------------- | ---------------------------------------- | ------------------------------------------------------ | ----------- |
| 1 — Beginner     | [`01-beginner/`](./01-beginner/)         | AuthN vs AuthZ, Sessions, JWT basics, Password hashing | 1–2 สัปดาห์ |
| 2 — Intermediate | [`02-intermediate/`](./02-intermediate/) | Refresh tokens, RBAC/ABAC, Middleware, IDOR            | 2–3 สัปดาห์ |
| 3 — Expert       | [`03-expert/`](./03-expert/)             | OAuth 2.0, OIDC, Keycloak, MFA, Zero-Trust hardening   | 2–4 สัปดาห์ |

แต่ละระดับประกอบด้วย:

1. **`README.md`** — ทฤษฎีเชิงลึกภาษาไทย ปรัชญาความปลอดภัย กลไกโปรโตคอล และช่องโหว่
2. **`src/`** — โค้ด TypeScript / Node.js ที่รันได้จริง
3. **`LAB.md`** — โจทย์สถานการณ์จริงพร้อมเฉลยวิธีคิด โครงสร้างไฟล์ และ script แก้ไข

---

## ข้อกำหนดเบื้องต้น

- ความรู้พื้นฐาน HTTP / JSON / REST และ JavaScript (async/await)
- ความเข้าใจเบื้องต้นเรื่อง cookies และ headers
- ติดตั้ง [Node.js 20+](https://nodejs.org/) และ (แนะนำ) [Docker](https://www.docker.com/) สำหรับ Redis / Keycloak

```bash
node -v # ควรเป็น v20.x ขึ้นไป
npm -v
docker --version # optional — สำหรับ Redis / Keycloak ในระดับ Intermediate+
```

---

## วิธีใช้ Bootcamp

1. เลือกระดับที่ต้องการ แล้ว `cd` เข้าไป
2. `npm install` เพื่อติดตั้ง dependencies
3. อ่าน `README.md` ของระดับนั้นให้จบ — โฟกัสที่ **ทำไมออกแบบแบบนี้** และ **ช่องโหว่ที่ต้องป้องกัน**
4. รันตัวอย่างด้วย `npm run demo` หรือ `npx tsx src/index.ts`
5. ทำ Lab ใน `LAB.md` **ด้วยตัวเองก่อน** แล้วค่อยดูเฉลย
6. ไประดับถัดไปเมื่ออธิบาย threat model และ trade-off ได้

```bash
cd 01-beginner
npm install
npm run demo
```

| บริการ (Docker) | Host Port | Notes                           |
| --------------- | --------- | ------------------------------- |
| Redis           | `6379`    | Session store / token blacklist |
| Keycloak        | `8080`    | Identity Provider (Expert)      |

```bash
cd 03-expert/infra
docker compose up -d
# REDIS_URL=redis://localhost:6379
# KEYCLOAK_URL=http://localhost:8080
```

---

## แผนที่แนวคิด (Mental Model)

```
┌─────────────────────────────────────────────────────────────┐
│      Identity Plane       │
│ Who are you? → AuthN (password, MFA, IdP, SSO)   │
├─────────────────────────────────────────────────────────────┤
│      Access Plane       │
│ What can you do? → AuthZ (RBAC, ABAC, scopes, policies) │
├─────────────────────────────────────────────────────────────┤
│      Trust Plane        │
│ How do we prove it continuously? → Tokens, sessions,  │
│ Zero-Trust checks at Gateway / Middleware     │
└─────────────────────────────────────────────────────────────┘
```

**หลักปรัชญาความปลอดภัยที่ใช้ตลอดหลักสูตร**

1. **Defense in Depth** — ไม่พึ่งชั้นป้องกันชั้นเดียว
2. **Least Privilege** — ให้สิทธิ์น้อยที่สุดที่จำเป็น
3. **Fail Secure** — เมื่อไม่แน่ใจ ให้ปฏิเสธ
4. **Never Trust the Client** — ตรวจทุก claim ที่ server
5. **Short-lived Credentials** — Access token อายุสั้น + rotation

---

## เส้นทางการเรียนรู้ที่แนะนำ

| สัปดาห์ | โฟกัส                              | สิ่งที่ต้องทำได้                             |
| ------- | ---------------------------------- | -------------------------------------------- |
| 1       | Beginner theory + password hashing | อธิบาย AuthN/AuthZ และ hash password ได้     |
| 2       | Sessions vs JWT + Lab 1            | ออกแบบ login ที่ปลอดภัยจาก session hijacking |
| 3–4     | Refresh tokens + RBAC              | Implement rotation + role middleware         |
| 5       | ABAC + IDOR Lab                    | ป้องกัน object-level authorization bugs      |
| 6–7     | OAuth/OIDC + Keycloak              | ตั้งค่า Authorization Code + PKCE            |
| 8       | MFA + Zero-Trust Lab               | Hardening ตาม OWASP API Top 10               |

---

## สิ่งที่หลักสูตรนี้ **ไม่** ครอบคลุมแบบลึก

- Cryptography จากศูนย์ (เช่น ออกแบบ cipher เอง) — ใช้มาตรฐานที่ผ่านการตรวจสอบแล้วเท่านั้น
- Physical security / network firewall policy ขององค์กร
- กฎหมาย PDPA/GDPR แบบละเอียด (แต่อ้างอิงหลักการ privacy-by-design)

---

## ใบอนุญาตการใช้งานโค้ดตัวอย่าง

โค้ดใน bootcamp นี้มีไว้เพื่อการศึกษาเท่านั้น
**ห้าม** นำ secret, key หรือ credential ในตัวอย่างไปใช้ใน production โดยตรง
