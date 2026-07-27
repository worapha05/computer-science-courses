# Level 3 — Expert: Threat Modeling, Secure SDLC & Incident Management

> **เป้าหมายระดับนี้:** ทำ Threat Modeling ด้วย STRIDE, ผสานความปลอดภัยเข้า SSDLC (SAST/DAST), ออกแบบ Audit Log ที่ต้านการปลอมแปลง และวางแผน Incident Response เบื้องต้น

---

## สารบัญ

1. [จากแนวคิดสู่กระบวนการ](#1-จากแนวคิดสู่กระบวนการ)
2. [Threat Modeling ด้วย STRIDE](#2-threat-modeling-ด้วย-stride)
3. [Secure Software Development Lifecycle (SSDLC)](#3-secure-software-development-lifecycle-ssdlc)
4. [SAST / DAST และ Quality Gates](#4-sast--dast-และ-quality-gates)
5. [Incident Response Basics](#5-incident-response-basics)
6. [Audit Logs สำหรับ Digital Forensics](#6-audit-logs-สำหรับ-digital-forensics)
7. [Best Practices](#7-best-practices)
8. [โครงสร้างโค้ดตัวอย่าง](#8-โครงสร้างโค้ดตัวอย่าง)

---

## 1. จากแนวคิดสู่กระบวนการ

ระดับ Beginner/Intermediate ให้เครื่องมือและ control
ระดับ Expert ถามว่า: **จะค้นพบภัยก่อนสร้างระบบ และจะตอบสนองเมื่อเกิดเหตุได้อย่างไร**

```
Requirements → Design (Threat Model)
  → Implement (secure coding)
  → Verify (SAST/DAST/review)
  → Release (gate)
  → Operate (logging/monitoring)
  → Respond (IR) → Learn (postmortem)
```

ความปลอดภัยที่ยั่งยืนคือ **feedback loop** ไม่ใช่ checklist ครั้งเดียว

---

## 2. Threat Modeling ด้วย STRIDE

### 2.1 STRIDE คืออะไร

กรอบของ Microsoft สำหรับจัดประเภทภัยคุกคามต่อองค์ประกอบของระบบ

| ตัวอักษร | Threat                 | เสาที่กระทบหลัก | คำถามชวนคิด                              |
| -------- | ---------------------- | --------------- | ---------------------------------------- |
| **S**    | Spoofing               | AuthN / C       | ปลอมเป็นใครได้หรือไม่?                   |
| **T**    | Tampering              | Integrity       | แก้ข้อมูลระหว่างทาง/ที่พักได้หรือไม่?    |
| **R**    | Repudiation            | Accountability  | ทำแล้วปฏิเสธได้เพราะไม่มีหลักฐานหรือไม่? |
| **I**    | Information Disclosure | Confidentiality | ข้อมูลรั่วจากจุดไหนได้บ้าง?              |
| **D**    | Denial of Service      | Availability    | ทำให้บริการล่มได้อย่างไร?                |
| **E**    | Elevation of Privilege | AuthZ           | จาก user ธรรมดาเป็น admin ได้อย่างไร?    |

### 2.2 ขั้นตอนปฏิบัติ

1. **วาด Data Flow Diagram (DFD)** — process, data store, external entity, trust boundary
2. **ระบุองค์ประกอบ** แล้วไล่ STRIDE ทีละชิ้น
3. **ประเมินความเสี่ยง** (Likelihood × Impact)
4. **เลือก mitigation** แล้วติดตามจนปิด

```
[User] ──HTTPS──► [API Gateway] ──► [App Service]
               │                     │
               │                     ▼
               │               [Postgres]
               ▼
         [Object Storage]
```

ตัวอย่าง threat เร็ว ๆ:

| องค์ประกอบ     | STRIDE      | Mitigation                                 |
| -------------- | ----------- | ------------------------------------------ |
| API Gateway    | Spoofing    | mTLS ระหว่าง service, ตรวจ JWT signature   |
| App → DB       | Tampering   | parameterized SQL, least-privilege DB user |
| Logs           | Repudiation | tamper-evident audit chain + time sync     |
| Object Storage | Disclosure  | private bucket + SSE + signed URL สั้น ๆ   |
| Login API      | DoS         | rate limit, WAF, autoscaling               |
| Admin API      | EoP         | RBAC + MFA + break-glass                   |

### 2.3 Trust Boundary

เส้นที่ระดับความเชื่อถือเปลี่ยน เช่น Internet → VPC, แอป → DB, tenant A → tenant B
ภัยส่วนใหญ่อยู่ที่ **การข้ามขอบโดยไม่ถูกตรวจ**

---

## 3. Secure Software Development Lifecycle (SSDLC)

SSDLC = แทรกกิจกรรมความปลอดภัยเข้าทุกเฟสของ SDLC

| เฟส            | กิจกรรมความปลอดภัย                                                          |
| -------------- | --------------------------------------------------------------------------- |
| Requirements   | Security requirements, privacy (PDPA), abuse cases                          |
| Design         | Threat modeling (STRIDE), security architecture review                      |
| Implementation | Secure coding standard, dependency pinning                                  |
| Verification   | Code review, SAST, SCA (Software Composition Analysis), unit security tests |
| Release        | DAST / pen-test ตามความเสี่ยง, sign artifacts                               |
| Maintenance    | Patch, IR drill, access review, re-threat-model เมื่อเปลี่ยนใหญ่            |

**Shift-left:** พบปัญหายิ่งเช้า ยิ่งถูก — ดีกว่าเจอใน production ตอนมีข่าว

---

## 4. SAST / DAST และ Quality Gates

| ประเภท             | ตรวจอะไร                  | จุดแข็ง                      | ข้อจำกัด                                      |
| ------------------ | ------------------------- | ---------------------------- | --------------------------------------------- |
| **SAST** (Static)  | โค้ดต้นทางโดยไม่รัน       | เจอ pattern อันตรายเร็วใน CI | False positive, ไม่เห็น runtime config        |
| **DAST** (Dynamic) | ยิงที่ระบบที่รันอยู่      | เห็นพฤติกรรมจริงของ HTTP     | ครอบคลุม path ได้ไม่ครบถ้าไม่มี crawl/auth ดี |
| **SCA**            | dependency มี CVE หรือไม่ | จับ lib เก่าที่มีช่องโหว่    | ต้องมี process update                         |

ตัวอย่าง Quality Gate ใน CI:

```
PR merge ได้เมื่อ:
 - SAST critical = 0
 - High vulnerabilities ใน dependency ที่ exploit ได้ = 0 (หรือมี exception ลงนาม)
 - Secret scanning ผ่าน
 - Unit tests + security regression tests ผ่าน
```

อย่าใช้ gate เป็นตัวเลขสวยอย่างเดียว — ต้องมีคน triage และเข้าใจความเสี่ยง

---

## 5. Incident Response Basics

วงจรมาตรฐาน (NIST-inspired อย่างย่อ):

```
1. Preparation    เตรียม playbook, contact, tooling, access
2. Detection      alert จาก log/IDS/user report
3. Containment    จำกัดความเสียหาย (revoke token, isolate host)
4. Eradication    ลบสาเหตุ (malware, backdoor, bad rule)
5. Recovery       เปิดบริการกลับอย่างปลอดภัย
6. Lessons Learned postmortem โดยไม่โจมตีบุคคล
```

**Preparation ที่มักขาด:**

- รายชื่อ on-call และช่องทางสื่อสารสำรอง
- สิทธิ์ break-glass ที่ audit ได้
- แผนเก็บหลักฐาน (อย่า reimage ทิ้งก่อนเก็บ volatile data ถ้าต้องการ forensics)

Severity ตัวอย่าง:

| Sev  | ตัวอย่าง                                           |
| ---- | -------------------------------------------------- |
| SEV1 | ข้อมูลลูกค้าจำนวนมากรั่ว / ระบบชำระเงินล่มทั้งระบบ |
| SEV2 | admin account ถูก takeover แต่จำกัดขอบเขตได้       |
| SEV3 | scanner ยิงพบบริการ non-prod เปิดผิด               |

---

## 6. Audit Logs สำหรับ Digital Forensics

### 6.1 ควร log อะไร

- ใคร (actor id / subject)
- ทำอะไร (action)
- กับอะไร (resource id)
- เมื่อไหร่ (UTC timestamp)
- จากไหน (IP, user-agent, request id)
- ผลลัพธ์ (success / deny / error code)

**ห้าม log:** รหัสผ่าน, token เต็ม, CVV, เลขบัตรเต็ม

### 6.2 ทำไมต้องต้านการปลอมแปลง (Tamper-evident)

ถ้าผู้โจมตีได้สิทธิ์สูง เขาอาจลบหรือแก้ log เพื่อ **Repudiation**
แนวทาง:

1. ส่ง log ไปยังระบบแยก (SIEM) ที่แอปเขียนได้อย่างเดียว
2. ใช้ **hash chain**: แต่ละเหตุการณ์มี `prevHash` ชี้ไปยังเหตุการณ์ก่อน
3. ลงนามช่วงเวลา (checkpoint) ด้วยคีย์แยก
4. เปิด WORM / object lock บน storage ถ้าเป็นไปได้

```
Event0: hash0 = H(event0)
Event1: hash1 = H(event1 || hash0)
Event2: hash2 = H(event2 || hash1)
...
ถ้าแก้ Event1 → hash1 เปลี่ยน → โซ่หลัง ๆ ตรวจไม่ผ่าน
```

### 6.3 นาฬิกาและลำดับเหตุการณ์

ใช้ NTP / เวลา UTC และ `requestId` เพื่อเรียงเหตุการณ์ข้ามบริการ — สำคัญมากตอน forensics

---

## 7. Best Practices

1. Threat model **ก่อน** เขียนโค้ด feature เสี่ยง (เงิน, PII, admin)
2. update threat model เมื่อเพิ่ม trust boundary ใหม่
3. ใส่ SAST + secret scan ในทุก PR
4. รัน DAST กับ staging ที่ mirror production config สำคัญ
5. แยก audit log store จากแอป และจำกัดสิทธิ์ลบ
6. ฝึก IR tabletop อย่างน้อยปีละครั้ง
7. Postmortem แบบ blameless โฟกัสระบบและกระบวนการ
8. วัด MTTD / MTTR ไม่ใช่แค่จำนวน alert
9. ใช้ PoLP กับ CI bot และ human admin เหมือนกัน
10. เอกสาร playbook ให้คนที่ง่วงตอนตีสามอ่านรู้เรื่อง

---

## 8. โครงสร้างโค้ดตัวอย่าง

```
03-expert/src/
├── index.ts
├── stride/
│   └── threat-model.ts      # ช่วยไล่ STRIDE บนองค์ประกอบระบบ
├── ssdlc/
│   └── quality-gates.ts     # จำลอง SAST/DAST/SCA gate ก่อน deploy
├── audit-log/
│   └── hash-chain.ts        # tamper-evident audit log
└── incident/
    └── playbook.ts          # ขั้นตอน IR แบบโปรแกรมช่วยเตือน
```

### วิธีรัน

```bash
cd basic-security-concepts
npm install
npm run expert:demo
```

อ่านต่อ: [`LAB.md`](./LAB.md)
