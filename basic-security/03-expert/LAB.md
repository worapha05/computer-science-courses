# Lab — Expert: Threat Model, SSDLC Gate และ Incident Response

> **คำแนะนำ:** ทำด้วยตัวเองก่อนเปิดเฉลย
> โฟกัสที่การคิดเชิงระบบและการจัดลำดับความเสี่ยง ไม่ใช่แค่กรอกตารางให้เต็ม

---

## สถานการณ์จำลอง

คุณเป็น Secure Software Architect ของ **"PayLeaf"** (ต่อจากระดับ Intermediate)

สถาปัตยกรรมปัจจุบัน:

```
[Customer App] ──TLS──► [API Gateway] ──► [Transfer Service]
              │                     │
              │                     ├──► [Postgres]
              │                     └──► [Redis queue]
              ▼
        [Object Storage backups]
              │
              ▼
        [Central SIEM] ← ยังไม่ได้ต่อจริง (แผนไว้)
```

ข้อเท็จจริงเพิ่ม:

- มี endpoint `POST /transfers` และ `GET /transfers/:id`
- Admin ใช้ VPN เข้า `POST /admin/users/:id/role`
- CI ยังไม่บล็อก critical SAST
- คืนวันศุกร์มี alert: จำนวน `transfer.create` จาก IP เดียวพุ่ง 50 เท่า และมี ticket จากลูกค้าว่าเห็นรายการโอนของคนอื่น

---

## Lab 3.1 — วาด DFD และไล่ STRIDE

### โจทย์

1. ระบุองค์ประกอบอย่างน้อย 6 ชิ้น (รวม trust boundary)
2. สร้าง threat อย่างน้อย **1 ข้อต่อหมวด STRIDE** (รวม 6+)
3. ให้ `likelihood` / `impact` (1–3) และ mitigation สั้น ๆ
4. จัดอันดับ top 3 ที่ต้องแก้ก่อนปล่อย feature ใหม่

### เกณฑ์ผ่าน

- [ ] มี DFD หรือรายการองค์ประกอบชัดเจน
- [ ] ครบ 6 หมวด STRIDE
- [ ] Top 3 สอดคล้องกับ score และบริบทธุรกิจเงิน

### คำใบ้

ใช้แนว `src/stride/threat-model.ts` (`stridePrompts`, `prioritize`)

---

## Lab 3.2 — ออกแบบ SSDLC Quality Gate

### โจทย์

กำหนดนโยบาย gate สำหรับ `staging` และ `production` แยกกัน:

| เงื่อนไข     | staging | production |
| ------------ | ------- | ---------- |
| max critical | ?       | ?          |
| max high     | ?       | ?          |
| secret scan  | ?       | ?          |
| ต้องมี DAST  | ?       | ?          |

จากนั้นจำลอง findings ชุดหนึ่งที่ต้อง **fail production** แต่ **อาจผ่าน staging ได้** พร้อมเหตุผล

### เกณฑ์ผ่าน

- [ ] นโยบายสองสภาพแวดล้อมต่างกันอย่างสมเหตุสมผล
- [ ] อธิบายได้ว่าทำไม production เข้มกว่า
- [ ] (โบนัส) ใช้ `evaluateQualityGate` จาก `src/ssdlc/quality-gates.ts`

---

## Lab 3.3 — ออกแบบ Tamper-evident Audit Log

### โจทย์

สำหรับเหตุการณ์ทางการเงิน ออกแบบ schema log อย่างน้อย:

`actorId, action, resource, outcome, timestamp, requestId, prevHash, hash`

ตอบคำถาม:

1. ฟิลด์ใดบ้างที่ **ห้าม** ใส่ใน log?
2. ถ้าแอปมีสิทธิ์ `DELETE` บนตาราง log อยู่ จะมีช่องโหว่หมวด STRIDE ใด?
3. จะพิสูจน์ได้อย่างไรว่า record กลางทางถูกแก้?

สร้างหรืออธิบาย function `verify()` ตามแนว hash chain

### เกณฑ์ผ่าน

- [ ] schema ครบสำหรับ forensics เบื้องต้น
- [ ] อธิบายการตรวจจับ tampering ได้
- [ ] ระบุการแยกสิทธิ์เก็บ log / SIEM

---

## Lab 3.4 — ฝึก Incident Response (Tabletop)

### โจทย์

จาก alert วันศุกร์ ให้เขียน timeline ทีมของคุณ:

| เวลา (สมมติ) | Phase     | การกระทำ | ผู้รับผิดชอบ |
| ------------ | --------- | -------- | ------------ |
| T+0          | detection | …        | …            |

ต้องมีอย่างน้อย: detection → containment → eradication → recovery → lessons learned

ระบุชัดว่าในช่วง containment คุณจะ:

- revoke อะไร
- เก็บหลักฐานอะไรก่อน isolate
- สื่อสารกับลูกค้าอย่างไรโดยไม่ทำให้สถานการณ์แย่ลง

### เกณฑ์ผ่าน

- [ ] ครบเฟสหลักของ IR
- [ ] มีการกันไม่ให้ลบหลักฐานก่อนเวลา
- [ ] มี action ระยะยาวหลัง postmortem (เช่น เพิ่ม object-level AuthZ test)

---

# เฉลย

<details>
<summary><strong>เฉลย Lab 3.1 — STRIDE</strong></summary>

องค์ประกอบตัวอย่าง: Customer App, API Gateway, Transfer Service, Postgres, Redis, Backup bucket, (Admin user), trust boundaries: internet→app, app→data, ops

| ID  | Category        | Threat                             | L   | I   | Mitigation                            |
| --- | --------------- | ---------------------------------- | --- | --- | ------------------------------------- |
| T1  | Spoofing        | ใช้ JWT ที่ขโมยมาเรียก /transfers  | 2   | 3   | short-lived token + binding / step-up |
| T2  | Tampering       | แก้ยอดในคิว Redis หรือ payload     | 2   | 3   | HMAC/sign internal messages + TLS     |
| T3  | Repudiation     | admin ปฏิเสธว่าไม่ได้เปลี่ยน role  | 2   | 2   | tamper-evident audit + SIEM           |
| T4  | Info Disclosure | IDOR อ่าน transfer ของคนอื่น       | 3   | 3   | object-level AuthZ                    |
| T5  | DoS             | flood /transfers                   | 3   | 2   | rate limit + backlog protection       |
| T6  | EoP             | เรียก /admin โดยไม่ผ่าน role check | 2   | 3   | gateway AuthZ + MFA admin             |

Top 3 ที่มักมาก่อนในเคสนี้: **T4 IDOR (Disclosure/EoP)**, **T1 token theft**, **T5 DoS** — ปรับตามหลักฐานคืนวันศุกร์ที่ชี้ว่ามีปัญหา authorization ชัดเจน

</details>

<details>
<summary><strong>เฉลย Lab 3.2 — Quality Gate</strong></summary>

| เงื่อนไข     | staging          | production |
| ------------ | ---------------- | ---------- |
| max critical | 0                | 0          |
| max high     | 3 (ต้องมี owner) | 0          |
| secret scan  | block            | block      |
| DAST         | แนะนำ            | บังคับ     |

ตัวอย่าง fail prod: มี SAST critical `sql-injection` หรือไม่มีผล DAST เลย
staging อาจผ่านชั่วคราวถ้า high ≤ 3 และมี ticket ติดตาม แต่ **ห้าม** มี secret

ใช้ `DEFAULT_PROD_POLICY` ใน `src/ssdlc/quality-gates.ts` เป็นจุดตั้งต้น

</details>

<details>
<summary><strong>เฉลย Lab 3.3 — Audit Log</strong></summary>

ห้าม log: password, refresh/access token เต็ม ๆ, CVV, เลขบัตรเต็ม, OTP

ถ้าแอป `DELETE` log ได้ → เสี่ยง **Repudiation** (+ ทำลายหลักฐาน forensics)

การพิสูจน์ tamper: รัน `verify()` ของ hash chain — ถ้าแก้ action ของ record กลางทาง hash จะไม่ตรงและโซ่ขาด
เสริม: ส่งสำเนาไป SIEM ที่แอปไม่มีสิทธิ์ลบ

ดู `src/audit-log/hash-chain.ts`

</details>

<details>
<summary><strong>เฉลย Lab 3.4 — IR Tabletop</strong></summary>

| เวลา  | Phase                 | การกระทำ                                                                                                            |
| ----- | --------------------- | ------------------------------------------------------------------------------------------------------------------- |
| T+0   | detection             | เปิด incident SEV2/SEV1 ตามขอบเขต, เก็บ request ids จาก alert                                                       |
| T+15m | containment           | บังคับ revoke session ของ IP/user ที่ผิดปกติ, feature-flag ปิดการดูรายการข้ามบัญชีถ้าเป็นไปได้, rate limit เข้มขึ้น |
| T+15m | containment (หลักฐาน) | snapshot log ช่วงเวลา, ห้าม reimage ทันทีถ้ายังต้องการ memory/disk evidence                                         |
| T+2h  | eradication           | แก้ IDOR, เพิ่ม regression test, หมุนคีย์ที่เกี่ยวข้อง                                                              |
| T+4h  | recovery              | deploy แบบค่อยเป็นค่อยไป เฝ้า error/authz deny metrics                                                              |
| T+2d  | lessons               | postmortem: ทำไม CI ไม่บล็อก, ทำไมไม่มี object AuthZ test, ต่อ SIEM ให้เสร็จ                                        |

การสื่อสารลูกค้า: ยอมรับว่ามีเหตุ, บอกสิ่งที่ทำเพื่อจำกัดผลกระทบ, ไม่โชว์รายละเอียด exploit ที่ช่วยผู้โจมตีรายอื่น

โครงสร้างไฟล์แนะนำสำหรับงานเขียนของคุณ:

```
lab/your-solution/
├── payleaf-stride.md
├── gate-policy.ts
├── audit-schema.md
└── ir-tabletop.md
```

</details>

---

## โครงสร้างไฟล์เฉลยโดยสรุป

```
03-expert/
├── README.md
├── LAB.md
└── src/
    ├── index.ts
    ├── stride/threat-model.ts
    ├── ssdlc/quality-gates.ts
    ├── audit-log/hash-chain.ts
    └── incident/playbook.ts
```
