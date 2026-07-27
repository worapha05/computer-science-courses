# Basic Security Concepts — Zero to Expert

bootcamp เรียนรู้ **แนวคิดความปลอดภัยไซเบอร์พื้นฐาน** แบบครบวงจร
จาก CIA Triad / Least Privilege → Cryptography & OWASP → Threat Modeling / Secure SDLC / Incident Response

---

## เป้าหมายของหลักสูตร

เมื่อจบหลักสูตรนี้ คุณจะสามารถ:

- อธิบาย **CIA Triad** และ **DAD Triad** พร้อมวิเคราะห์ผลกระทบเมื่อเสาหลักใดหักลง
- ออกแบบสิทธิ์ตาม **Principle of Least Privilege** และลด **Attack Surface**
- วาง **Defense in Depth** หลายชั้น (Network → Host → Application → Data)
- แยก **Encryption / Hashing / Encoding** และเลือกใช้ AES / RSA ได้ถูกต้อง
- ระบุและป้องกันช่องโหว่เบื้องต้นใน **OWASP Top 10** (Injection, Broken Auth, Sensitive Data Exposure)
- ทำ **Threat Modeling ด้วย STRIDE** และผสานความปลอดภัยเข้า **SSDLC**
- ออกแบบ **Audit Logs** ที่ต้านการปลอมแปลง และวางแผน **Incident Response** เบื้องต้น

---

## โครงสร้างหลักสูตร

| Level            | folder                                   | หัวข้อหลัก                                               | เวลาแนะนำ   |
| ---------------- | ---------------------------------------- | -------------------------------------------------------- | ----------- |
| 1 — Beginner     | [`01-beginner/`](./01-beginner/)         | CIA/DAD Triad, PoLP, Defense in Depth, Rate Limiting     | 1–2 สัปดาห์ |
| 2 — Intermediate | [`02-intermediate/`](./02-intermediate/) | AES/RSA, Hashing vs Encoding, OWASP Top 10, Sanitization | 2–3 สัปดาห์ |
| 3 — Expert       | [`03-expert/`](./03-expert/)             | STRIDE, SSDLC (SAST/DAST), Tamper-evident Logs, IR       | 2–4 สัปดาห์ |

แต่ละระดับประกอบด้วย:

1. **`README.md`** — ทฤษฎีเชิงลึกภาษาไทย แกนหลักความปลอดภัย การประเมินความเสี่ยง และ Best Practices
2. **`src/`** — โค้ด TypeScript ที่รันได้จริง (encryption, rate limiting, sanitization, audit log, …)
3. **`LAB.md`** — โจทย์วิเคราะห์ช่องโหว่ / Threat Modeling / ออกแบบสถาปัตยกรรม พร้อมเฉลยครบถ้วน

---

## ข้อกำหนดเบื้องต้น

- ความรู้พื้นฐาน programming (ตัวแปร, function, async)
- เคยเขียน JavaScript หรือ TypeScript มาบ้าง
- ความเข้าใจเบื้องต้นเรื่อง HTTP / JSON
- ติดตั้ง [Node.js 20 LTS+](https://nodejs.org/)

```bash
node -v # ควรเป็น v20.x ขึ้นไป
npm -v
```

---

## วิธีใช้ Bootcamp

1. เลือกระดับที่ต้องการ แล้ว `cd` เข้าไป
2. `npm install` เพื่อติดตั้ง dependencies
3. อ่าน `README.md` ของระดับนั้นให้จบ — โฟกัสที่ **ทำไมต้องป้องกันแบบนี้** ไม่ใช่แค่เครื่องมือ
4. รันตัวอย่างด้วย `npm run demo` หรือ `npx tsx src/index.ts`
5. ทำ Lab ใน `LAB.md` **ด้วยตัวเองก่อน** แล้วค่อยดูเฉลย
6. ไประดับถัดไปเมื่ออธิบาย threat model และ trade-off ได้

```bash
cd 01-beginner
npm install
npm run demo

# หรือเลือกอีกระดับ
cd ../02-intermediate
npm install
npm run demo
```

---

## แผนการเรียนรู้ที่แนะนำ

```
สัปดาห์ 1–2   Beginner      อ่านทฤษฎี → รัน demo → Lab วิเคราะห์เคส CIA/PoLP
สัปดาห์ 3–5   Intermediate  อ่าน Crypto + OWASP → รัน demo → Lab แก้ Injection
สัปดาห์ 6–9   Expert        STRIDE whiteboard → SSDLC checklist → Lab IR + logs
```

**กฎทอง:** ความปลอดภัยคือการจัดการความเสี่ยง ไม่ใช่การกำจัดความเสี่ยงให้เป็นศูนย์ — เลือก control ที่สมดุลกับผลกระทบทางธุรกิจ

---

## แผนที่แนวคิด (Concept Map)

```
        ┌─────────────────────────────┐
        │      Security Goals         │
        │    CIA Triad ↔ DAD Triad    │
        └─────────────┬───────────────┘
                      │
        ┌─────────────┼──────────────┐
        ▼             ▼              ▼
  Least Privilege  Defense in Depth  Risk Assessment
        │             │              │
        └─────────────┼──────────────┘
                      ▼
        ┌──────────────────────────────┐
        │ Cryptography & Web Hardening │
        │ AES/RSA · Hash · OWASP Top 10│
        └──────────────┬───────────────┘
                       ▼
        ┌──────────────────────────────┐
        │ Secure Process & Operations  │
        │ STRIDE · SSDLC · IR · Forensics│
        └──────────────────────────────┘
```

---

## จริยธรรมและความรับผิดชอบ

โค้ดและ Lab ในหลักสูตรนี้มีไว้เพื่อ **การเรียนรู้และการป้องกันเท่านั้น**

- ห้ามนำไปทดสอบระบบที่คุณไม่มีสิทธิ์
- ห้ามใช้เทคนิค injection / tampering กับระบบจริงโดยไม่ได้รับอนุญาต
- เป้าหมายคือสร้างนักพัฒนาที่คิดแบบ defensive ไม่ใช่ offensive โดยไม่ชอบด้วยกฎหมาย

---

## เส้นทางต่อยอด

| หัวข้อถัดไป                 | Bootcamp ที่เกี่ยวข้องใน repo         |
| --------------------------- | ------------------------------------- |
| AuthN / AuthZ / JWT / OAuth | `auth-identity-bootcamp`              |
| HTTP / TLS / Headers        | `http-https-protocols-bootcamp`       |
| CI/CD Security Gates        | `cicd-pipeline-bootcamp`              |
| API Hardening               | `advanced-api-communication-bootcamp` |
