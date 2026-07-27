# Level 1 — Beginner: The Core Triad & Security Philosophy

> **เป้าหมายระดับนี้:** เข้าใจ CIA/DAD Triad, ออกแบบสิทธิ์ตาม Least Privilege, วาง Defense in Depth และลด Attack Surface ได้จริง

---

## สารบัญ

1. [ปรัชญาความปลอดภัยเบื้องต้น](#1-ปรัชญาความปลอดภัยเบื้องต้น)
2. [The CIA Triad](#2-the-cia-triad)
3. [The DAD Triad](#3-the-dad-triad)
4. [Principle of Least Privilege (PoLP)](#4-principle-of-least-privilege-polp)
5. [Defense in Depth](#5-defense-in-depth)
6. [การประเมินความเสี่ยงเบื้องต้น](#6-การประเมินความเสี่ยงเบื้องต้น)
7. [ช่องโหว่พื้นฐานที่พบบ่อย](#7-ช่องโหว่พื้นฐานที่พบบ่อย)
8. [Best Practices](#8-best-practices)
9. [โครงสร้างโค้ดตัวอย่าง](#9-โครงสร้างโค้ดตัวอย่าง)

---

## 1. ปรัชญาความปลอดภัยเบื้องต้น

ความปลอดภัยสารสนเทศไม่ใช่ผลิตภัณฑ์ที่ซื้อครั้งเดียวแล้วจบ แต่เป็น **กระบวนการจัดการความเสี่ยงอย่างต่อเนื่อง**

หลักคิดสำคัญ:

| หลักการ                   | ความหมายในทางปฏิบัติ                               |
| ------------------------- | -------------------------------------------------- |
| **Security is a process** | ภัยคุกคามเปลี่ยนตลอด — control ต้องทบทวนเป็นระยะ   |
| **Assume breach**         | สมมติว่าชั้นหนึ่งอาจพังได้ จึงต้องมีชั้นสำรอง      |
| **Risk-based decisions**  | ลงทุนป้องกันตามความรุนแรง × โอกาสเกิด              |
| **Usable security**       | control ที่ใช้ยากเกินไป มักถูก bypass โดยผู้ใช้เอง |

**กฎทอง:** อย่าเชื่อข้อมูลจาก client โดยไม่ตรวจสอบ และอย่าให้สิทธิ์เกินกว่าที่จำเป็นต่องาน

---

## 2. The CIA Triad

CIA Triad คือเสาหลักสามต้นของความปลอดภัยสารสนเทศ

```
   Confidentiality
       /\
      /  \
     /    \
    /______\
  Integrity  Availability
```

### 2.1 Confidentiality (รักษาความลับ)

ข้อมูลเข้าถึงได้เฉพาะผู้มีสิทธิ์เท่านั้น

**กลไกที่ใช้บ่อย:**

- Access Control / Authorization
- Encryption (at rest / in transit)
- Classification ของข้อมูล (Public / Internal / Confidential / Restricted)
- Need-to-know policy

**กรณีศึกษาเมื่อ Confidentiality หัก:**

> พนักงานคลังสินค้าถูกแชร์ไฟล์ Excel เงินเดือนทั้งบริษัทบน folder สาธารณะ
> → ข้อมูลส่วนบุคคลรั่วไหล → ละเมิด PDPA / ความไว้วางใจพัง / อาจถูกเรียกร้องค่าเสียหาย

### 2.2 Integrity (รักษาความถูกต้อง)

ข้อมูลไม่ถูกแก้ไขโดยไม่ได้รับอนุญาต หรือแก้ไขแล้วต้องตรวจพบได้

**กลไกที่ใช้บ่อย:**

- Digital signatures / HMAC
- Checksums / Hash verification
- Version control + immutable logs
- Input validation

**กรณีศึกษาเมื่อ Integrity หัก:**

> ผู้โจมตีแก้ราคาในฐานข้อมูลจาก 1,990 บาท เป็น 19 บาท โดยไม่มี audit
> → ออเดอร์ผิดพลาด → สูญเสียรายได้ → ไม่รู้ว่าใครแก้เมื่อไหร่

### 2.3 Availability (พร้อมใช้งานเสมอ)

ระบบและข้อมูลพร้อมใช้เมื่อต้องการ ในระดับที่ธุรกิจยอมรับได้ (SLA)

**กลไกที่ใช้บ่อย:**

- Redundancy / Failover
- Backups & Disaster Recovery
- Rate limiting / DDoS mitigation
- Capacity planning

**กรณีศึกษาเมื่อ Availability หัก:**

> ระบบชำระเงินถูก flood ด้วย request จนล่มช่วง flash sale
> → ลูกค้าซื้อไม่ได้ → เสียรายได้และชื่อเสียง

### 2.4 ความสัมพันธ์ของทั้งสามเสา

| สถานการณ์                           | C   | I   | A   | หมายเหตุ                                           |
| ----------------------------------- | --- | --- | --- | -------------------------------------------------- |
| Encrypt ทุกอย่างด้วยคีย์เดียวที่หาย | ✅  | ✅  | ❌  | ความลับดี แต่ใช้ไม่ได้                             |
| เปิด public write โดยไม่ auth       | ❌  | ❌  | ✅  | ใช้ได้ แต่ไม่ปลอดภัย                               |
| Backup ทุกวัน แต่ไม่ encrypt        | ⚠️  | ✅  | ✅  | Availability/Integrity ดี แต่ Confidentiality อ่อน |

การออกแบบที่ดีคือ **สมดุลตามบริบทธุรกิจ** ไม่ใช่เพิ่ม control สูงสุดทุกมิติ

---

## 3. The DAD Triad

DAD คือคู่ตรงข้ามของ CIA — มุมมองของภัยคุกคาม

| CIA Goal        | DAD Threat      | คำอธิบาย                        |
| --------------- | --------------- | ------------------------------- |
| Confidentiality | **Disclosure**  | เปิดเผยข้อมูลโดยไม่ได้รับอนุญาต |
| Integrity       | **Alteration**  | แก้ไขข้อมูลโดยไม่ชอบด้วยสิทธิ์  |
| Availability    | **Destruction** | ทำลายหรือทำให้ใช้ไม่ได้         |

การใช้ DAD ช่วยให้ถามคำถามกลับด้าน:

- ใครสามารถ **disclose** ข้อมูลลูกค้าได้บ้าง?
- จุดไหนที่ attacker สามารถ **alter** คำสั่งซื้อได้?
- ทรัพยากรใดที่ถ้าถูก **destroy** แล้วธุรกิจหยุดทันที?

```
CIA (สิ่งที่เราปกป้อง)       DAD (สิ่งที่ผู้โจมตีทำ)
─────────────────────       ─────────────────────
Confidentiality      ←→     Disclosure
Integrity            ←→     Alteration
Availability         ←→     Destruction / DoS
```

---

## 4. Principle of Least Privilege (PoLP)

### 4.1 ความหมาย

ให้สิทธิ์ **เท่าที่จำเป็น** ต่องาน และ **จำกัดเวลา** ที่ใช้สิทธิ์นั้น

ตัวอย่าง:

| บทบาท         | สิทธิ์ที่ควรได้       | สิทธิ์ที่ไม่ควรได้                  |
| ------------- | --------------------- | ----------------------------------- |
| Support staff | อ่าน ticket ของลูกค้า | ลบฐานข้อมูลทั้งหมด                  |
| CI deploy bot | push image ไป staging | SSH เป็น root ทุกเครื่อง production |
| Mobile app    | เรียก API ของตัวเอง   | เข้า admin dashboard                |

### 4.2 การลด Attack Surface

**Attack Surface** = จุดที่ attacker สามารถโต้ตอบกับระบบได้

วิธีลด:

1. ปิด port/บริการที่ไม่ใช้
2. ลบ feature flags / debug endpoints ใน production
3. แยก network (segmentation)
4. ใช้ allowlist แทน denylist เมื่อเป็นไปได้
5. ลดสิทธิ์ process (อย่ารันแอปเป็น root)

```
ก่อน PoLP                    หลัง PoLP
┌─────────────────────┐     ┌───────────────────────────────┐
│ App user = root     │     │ App user = appuser            │
│ DB = full admin     │  →  │ DB = CRUD เฉพาะ schema นั้น  │
│ API = *:* open      │     │ API = scoped tokens           │
│ Attack surface ใหญ่ │     │ Attack surface เล็ก          │
└─────────────────────┘     └───────────────────────────────┘
```

### 4.3 Privilege Creep

สิทธิ์มัก **สะสมตามเวลา** เมื่อคนย้ายทีมแต่ไม่ได้ revoke สิทธิ์เก่า
→ ต้องมี access review เป็นระยะ (เช่น ทุกไตรมาส)

---

## 5. Defense in Depth

วางแนวป้องกันหลายชั้น เพื่อไม่ให้เกิด **Single Point of Failure** ฝั่งความปลอดภัย

```
┌──────────────────────────────────────────────┐
│ Layer 1: Network — Firewall, WAF, VPN        │
├──────────────────────────────────────────────┤
│ Layer 2: Host — Patch, Hardening, EDR        │
├──────────────────────────────────────────────┤
│ Layer 3: Application — AuthZ, Validation, RLS│
├──────────────────────────────────────────────┤
│ Layer 4: Data — Encryption, Masking          │
└──────────────────────────────────────────────┘
        ▲
        │ ผู้โจมตีต้องทะลุหลายชั้น
```

| ชั้น        | Control ตัวอย่าง            | ถ้าชั้นนี้พัง                     |
| ----------- | --------------------------- | --------------------------------- |
| Network     | WAF กัน SQLi pattern        | ยังมี parameterized query ที่ App |
| Host        | OS patch                    | ยังมี container isolation         |
| Application | AuthZ ตรวจ object ownership | ยังมี encryption ที่ Data         |
| Data        | AES-256 at rest             | ลดความเสียหายเมื่อถูกขโมยไฟล์     |

**หลักคิด:** แต่ละชั้นต้อง **อิสระพอ** ที่จะยังทำงานได้แม้ชั้นอื่นล้มเหลว

---

## 6. การประเมินความเสี่ยงเบื้องต้น

สูตรง่ายที่ใช้สื่อสารกับธุรกิจ:

```
Risk ≈ Likelihood × Impact
```

| Likelihood | Impact | ความหมาย    | ตัวอย่างการตัดสินใจ    |
| ---------- | ------ | ----------- | ---------------------- |
| สูง        | สูง    | Critical    | แก้ทันที / หยุด deploy |
| สูง        | ต่ำ    | Medium      | backlog + monitor      |
| ต่ำ        | สูง    | Medium–High | ลดโอกาส + แผน IR       |
| ต่ำ        | ต่ำ    | Low         | ยอมรับหรือเลื่อนได้    |

**Asset** ที่ควรมองก่อน: ข้อมูลลูกค้า, ระบบชำระเงิน, credentials, backup, admin console

---

## 7. ช่องโหว่พื้นฐานที่พบบ่อย

| ช่องโหว่                 | เสาที่กระทบ | สาเหตุหลัก              |
| ------------------------ | ----------- | ----------------------- |
| Hardcoded credentials    | C           | ไม่แยก secret จากโค้ด   |
| Over-privileged IAM      | C/I/A       | ไม่ทำ PoLP              |
| ไม่มี rate limit         | A           | ถูก brute-force / flood |
| ไม่มี integrity check    | I           | แก้ข้อมูลแล้วไม่รู้     |
| Single firewall เท่านั้น | ทั้งสาม     | ไม่มี Defense in Depth  |

---

## 8. Best Practices

1. **เริ่มจาก asset ที่สำคัญที่สุด** แล้วไล่ control ตามความเสี่ยง
2. **ให้สิทธิ์แบบ deny-by-default** แล้วเปิดเฉพาะที่จำเป็น
3. **แยกสภาพแวดล้อม** (dev / staging / prod) และแยก credentials
4. **บันทึกและทบทวนสิทธิ์** เป็นระยะ (access review)
5. **อย่าพึ่งชั้นเดียว** — ถ้ามีแค่ firewall หรือแค่ encryption ก็ยังไม่พอ
6. **ออกแบบให้ fail securely** — เมื่อระบบผิดพลาด ควรปฏิเสธ ไม่ใช่เปิดสิทธิ์เต็ม
7. **Rate limit จุดที่ถูก abuse ได้** เช่น login, OTP, password reset
8. **สอนทีมให้คิดแบบ CIA/DAD** ตอนออกแบบ feature ใหม่

---

## 9. โครงสร้างโค้ดตัวอย่าง

```
01-beginner/src/
├── index.ts                # รัน demo รวมทุก module
├── cia/
│   └── cia-demo.ts         # จำลองการละเมิด/ปกป้อง CIA
├── polp/
│   └── least-privilege.ts  # RBAC แบบ PoLP + deny-by-default
├── defense-in-depth/
│   └── layers.ts           # หลายชั้นป้องกันก่อนเข้าถึงข้อมูล
└── rate-limiting/
    └── token-bucket.ts     # Rate limit เพื่อปกป้อง Availability
```

### วิธีรัน

```bash
cd basic-security-concepts
npm install
npm run beginner:demo
```

อ่านต่อ: [`LAB.md`](./LAB.md) สำหรับโจทย์วิเคราะห์สถานการณ์จริง
