# Lab — Beginner: วิเคราะห์เสาหลักความปลอดภัยและออกแบบสิทธิ์

> **คำแนะนำ:** ทำด้วยตัวเองก่อนเปิดเฉลย
> โฟกัสที่การวิเคราะห์ผลกระทบ CIA/DAD และการลด Attack Surface ไม่ใช่แค่เขียนโค้ดให้ผ่าน

---

## สถานการณ์จำลอง

คุณเป็น Security Champion ของ startup **"MediTrack"** — แอปนัดหมายคลินิกขนาดเล็ก

ระบบปัจจุบัน:

- API เดียวรันบน VM ตัวเดียว (user = `root`)
- ฐานข้อมูลมีตาราง `patients` (ชื่อ, เลขบัตรประชาชน, ประวัติแพ้ยา)
- พนักงานรับโทรศัพท์ แพทย์ และแอดมิน ใช้บัญชีเดียวกันชื่อ `staff` / รหัสผ่านเดียวกัน
- ไม่มี rate limit ที่ `/login`
- Backup ถูกวางไว้ที่ folder `/var/backups` ที่ทุกคนในเครื่องอ่านได้

คืนหนึ่งมีเหตุการณ์:

1. มีคนเดารหัสผ่าน `staff` สำเร็จหลังลองประมาณ 2,000 ครั้ง
2. download ไฟล์ backup ทั้งก้อน
3. แก้สถานะนัดหมายบางรายการใน DB โดยตรง

---

## Lab 1.1 — วิเคราะห์ CIA / DAD

### โจทย์

ตารางวิเคราะห์ให้ครบทั้ง 3 เสา:

| เหตุการณ์ | เสา CIA ที่เสีย | ภัย DAD ที่เกิด | ผลกระทบทางธุรกิจ |
| --------- | --------------- | --------------- | ---------------- |
| …         | …               | …               | …                |

ตอบคำถามเพิ่ม:

1. เหตุการณ์ใดกระทบมากกว่าหนึ่งเสาพร้อมกัน?
2. ถ้า encrypt backup ด้วยคีย์ที่เก็บในไฟล์เดียวกันบน VM นั้น จะช่วย Confidentiality ได้จริงหรือไม่ เพราะอะไร?

### เกณฑ์ผ่าน

- [ ] มีอย่างน้อย 3 แถววิเคราะห์ครบ
- [ ] อธิบายได้ว่า Disclosure / Alteration / Destruction ตรงกับเหตุการณ์ใด
- [ ] ระบุได้ว่าการ encrypt อย่างเดียวโดยไม่แยกคีย์ยังไม่พอ

### คำใบ้

ดู `src/cia/cia-demo.ts` เรื่องการกัน Disclosure และจับ Alteration ด้วย checksum

---

## Lab 1.2 — ออกแบบ PoLP สำหรับบทบาท MediTrack

### โจทย์

ออกแบบตาราง Role → Permission แบบ deny-by-default สำหรับ:

| Role           | งานที่ทำจริง                                               |
| -------------- | ---------------------------------------------------------- |
| `receptionist` | สร้าง/แก้เวลานัด ดูชื่อผู้ป่วย (ไม่ดูเลขบัตรเต็ม)          |
| `doctor`       | ดูประวัติแพ้ยาของผู้ป่วยในคลินิกตัวเอง เขียนบันทึกการรักษา |
| `admin`        | จัดการบัญชีพนักงาน ดูรายงานรวม                             |
| `backup-job`   | อ่าน DB เพื่อสำรองข้อมูลเท่านั้น                           |

ข้อบังคับ:

1. ไม่มี role ใดได้ `*` (wildcard)
2. `backup-job` ห้ามมีสิทธิ์เขียน
3. เลขบัตรประชาชนเต็มเห็นได้เฉพาะ `doctor` และต้องมีเหตุผลทางคลินิก

### เกณฑ์ผ่าน

- [ ] มีตาราง permission ที่ชัดเจน
- [ ] อธิบาย Attack Surface ที่ลดลงเมื่อแยกบัญชี `staff` เดิมออกเป็นหลาย role
- [ ] (โบนัส) เขียน function `authorize()` ในแนวเดียวกับ `src/polp/least-privilege.ts`

---

## Lab 1.3 — Defense in Depth สำหรับ MediTrack

### โจทย์

วาด/เขียนชั้นป้องกันอย่างน้อย 4 ชั้น (Network / Host / Application / Data)
ระบุ control อย่างน้อย 1 อย่างต่อชั้น ที่จะช่วยลดความเสียหายจากเหตุการณ์คืนนั้น

จากนั้นตอบ:

> ถ้า WAF (Network) พลาด ไม่จับ brute-force ได้ Application หรือ Host ชั้นใดควรกันต่อ?

### เกณฑ์ผ่าน

- [ ] มี 4 ชั้นพร้อม control
- [ ] ไม่มีชั้นใดเป็น Single Point of Failure เพียงอย่างเดียวในคำตอบ
- [ ] ระบุ rate limiting ไว้ที่ชั้นที่เหมาะสม

---

## Lab 1.4 — ใส่ Rate Limit ที่ `/login`

### โจทย์

ใช้แนว `TokenBucket` / `KeyedRateLimiter` จาก `src/rate-limiting/token-bucket.ts`
ออกแบบนโยบาย:

- จำกัดต่อ IP หรือต่อ username (เลือกอย่างใดอย่างหนึ่งแล้วให้เหตุผล)
- ค่า capacity / refill ที่สมเหตุสมผลสำหรับคลินิกขนาดเล็ก
- เมื่อถูกบล็อก ควรตอบ HTTP status อะไร และข้อความควรเป็นแบบใดเพื่อไม่ช่วย user enumeration

### เกณฑ์ผ่าน

- [ ] ระบุตัวเลขนโยบายได้
- [ ] อธิบายว่าช่วยเสา Availability และลดโอกาส Disclosure จาก credential stuffing อย่างไร
- [ ] (โบนัส) เขียน script สั้น ๆ ที่จำลอง 20 ครั้ง login จาก IP เดียวกันแล้วแสดงผล BLOCK

---

# เฉลย

<details>
<summary><strong>เฉลย Lab 1.1 — CIA / DAD</strong></summary>

| เหตุการณ์                           | เสา CIA ที่เสีย                      | ภัย DAD     | ผลกระทบ                                |
| ----------------------------------- | ------------------------------------ | ----------- | -------------------------------------- |
| Brute-force สำเร็จเข้าบัญชี `staff` | Confidentiality (+ เสี่ยง Integrity) | Disclosure  | เข้าถึงข้อมูลผู้ป่วยโดยไม่ได้รับอนุญาต |
| download backup ทั้งก้อน            | Confidentiality                      | Disclosure  | ละเมิดความเป็นส่วนตัว / PDPA           |
| แก้สถานะนัดใน DB                    | Integrity                            | Alteration  | นัดผิดพลาด ความเชื่อถือพัง             |
| (ถ้าลบข้อมูลทิ้ง)                   | Availability                         | Destruction | คลินิกทำงานต่อไม่ได้                   |

เหตุการณ์ที่กระทบหลายเสา: การได้ credential admin-like มักนำไปสู่ได้ทั้งอ่าน (C) และแก้ (I) และอาจลบ (A)

Encrypt backup แต่เก็บคีย์บน VM เดียวกัน: **ช่วยได้น้อยมาก** เพราะผู้ที่ได้สิทธิ์อ่านไฟล์บนเครื่องมักอ่านทั้ง ciphertext และ key → ต้องแยก key ไปยัง KMS / secret manager / เครื่องอื่น

</details>

<details>
<summary><strong>เฉลย Lab 1.2 — PoLP</strong></summary>

ตัวอย่าง permission matrix:

| Permission               | receptionist | doctor | admin | backup-job |
| ------------------------ | :----------: | :----: | :---: | :--------: |
| `appointments:read`      |      ✓       |   ✓    |   ✓   |            |
| `appointments:write`     |      ✓       |   ✓    |       |            |
| `patients:read_basic`    |      ✓       |   ✓    |   ✓   |            |
| `patients:read_pii_full` |              |   ✓    |       |            |
| `clinical_notes:write`   |              |   ✓    |       |            |
| `users:manage`           |              |        |   ✓   |            |
| `reports:read`           |              |        |   ✓   |            |
| `db:read_backup`         |              |        |       |     ✓      |

Attack Surface ที่ลดลง: เดิมบัญชีเดียวทำได้ทุกอย่าง → ตอนนี้ credential ของ receptionist รั่วจะไม่เห็นเลขบัตรเต็มและจัดการ users ไม่ได้

โครงสร้างไฟล์แนะนำ:

```
lab/your-solution/
└── medi-track-rbac.ts
```

</details>

<details>
<summary><strong>เฉลย Lab 1.3 — Defense in Depth</strong></summary>

| ชั้น        | Control ตัวอย่างสำหรับ MediTrack                                       |
| ----------- | ---------------------------------------------------------------------- |
| Network     | WAF / security group เปิดเฉพาะ 443, จำกัดประเทศถ้าเหมาะ                |
| Host        | ห้ามรันแอปเป็น root, patch OS, ปิด SSH password auth                   |
| Application | แยก role, rate limit `/login`, session timeout                         |
| Data        | encrypt backup ด้วย KMS, column masking เลขบัตร, soft DB user ตาม role |

ถ้า WAF พลาด: **Application rate limit + account lockout** และ **Host fail2ban / IDS** ควรกันต่อ — นี่คือหัวใจของ Defense in Depth

</details>

<details>
<summary><strong>เฉลย Lab 1.4 — Rate Limit</strong></summary>

นโยบายตัวอย่างสำหรับคลินิกเล็ก:

- Key = `ip + username` (กันทั้งยิงกระจาย username และยิง username เดียวจากหลาย IP ได้บางส่วน)
- Capacity = 5, refill = 0.2/วินาที (ประมาณ 12 ครั้ง/นาทีหลังจากหมดโควต้า)
- HTTP **429 Too Many Requests**
- ข้อความกลาง ๆ: `"คำขอล้มเหลว กรุณาลองใหม่ภายหลัง"` — อย่าบอกว่า user มีจริงหรือไม่

ช่วย Availability โดยกัน flood และลดโอกาส Disclosure เพราะ brute-force ช้าลงจนตรวจจับได้

แนวทางโค้ด: ใช้ `KeyedRateLimiter` จาก `src/rate-limiting/token-bucket.ts` ครอบ handler ของ `/login`

</details>

---

## โครงสร้างไฟล์เฉลยโดยสรุป

```
01-beginner/
├── README.md
├── LAB.md
└── src/
    ├── index.ts
    ├── cia/cia-demo.ts
    ├── polp/least-privilege.ts
    ├── defense-in-depth/layers.ts
    └── rate-limiting/token-bucket.ts
```
