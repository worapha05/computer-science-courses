# Lab — Intermediate: Token Revocation, RBAC/ABAC และป้องกัน IDOR

> ทำด้วยตัวเองก่อนเปิดเฉลย — เน้นออกแบบให้ถอนสิทธิ์ได้จริงและกัน privilege escalation

---

## สถานการณ์จำลอง

บริษัท **FinLedger** มี API สำหรับจัดการใบแจ้งหนี้ (invoices)

บทบาท:

| Role              | สิทธิ์                                   |
| ----------------- | ---------------------------------------- |
| `viewer`          | อ่านใบแจ้งหนี้ของตัวเอง                  |
| `accountant`      | อ่าน/สร้างใบแจ้งหนี้ในแผนกตัวเอง         |
| `finance_manager` | refund ได้ถ้า amount ≤ limit และผ่าน MFA |
| `admin`           | จัดการทุกอย่าง + audit                   |

เกิดเหตุ 2 เคส:

1. พนักงานลาออกแล้ว แต่ refresh token ยังใช้ได้
2. ผู้ใช้ A เปลี่ยน `invoiceId` ใน URL แล้วเห็นข้อมูลของ B (IDOR)

---

## Lab 2.1 — Access + Refresh + Rotation

### โจทย์

Implement:

```
POST /auth/login
POST /auth/refresh
POST /auth/logout
```

ข้อกำหนด:

1. Access TTL = 10 นาที, Refresh TTL = 7 วัน
2. Refresh ใช้ได้ **ครั้งเดียว** (rotation)
3. เก็บเฉพาะ `sha256(refreshToken)` ใน store
4. ถ้า refresh ถูกใช้ซ้ำ → revoke ทั้ง token family
5. Logout → blacklist access `jti` + ลบ refresh family

### เกณฑ์ผ่าน

- [ ] refresh ครั้งที่ 1 ได้คู่ใหม่
- [ ] ใช้ refresh เก่าซ้ำ → 401 และ family ถูกถอน
- [ ] หลัง logout, access token เดิมเข้า API ไม่ได้ (ผ่าน blacklist)

---

## Lab 2.2 — RBAC Middleware

### โจทย์

สร้าง `requirePermission('invoices:write')` และผูกกับ routes:

| Method | Path            | Permission        |
| ------ | --------------- | ----------------- |
| GET    | `/invoices`     | `invoices:read`   |
| POST   | `/invoices`     | `invoices:write`  |
| DELETE | `/invoices/:id` | `invoices:delete` |

### เกณฑ์ผ่าน

- [ ] ไม่มี token → 401
- [ ] มี token แต่ role ไม่พอ → 403
- [ ] role พอ → 200/201

---

## Lab 2.3 — ABAC Refund Policy

### โจทย์

`POST /invoices/:id/refund` อนุญาตเมื่อครบทุกข้อ:

1. subject มี role `finance_manager` หรือ permission `invoices:refund`
2. `resource.department == subject.department`
3. `resource.amount <= subject.refundLimit`
4. `subject.mfa == true`
5. เวลาอยู่ในเวลาทำการ 09:00–18:00 (timezone ของ lab: Asia/Bangkok)

นอกนั้น → 403 พร้อมเหตุผลแบบไม่ leak ข้อมูลเกินจำเป็น

---

## Lab 2.4 — แก้ IDOR ในระบบ Invoices

### เหตุการณ์

`GET /invoices/:id` เดิมโหลดตาม id อย่างเดียว:

```typescript
const invoice = db.findById(req.params.id);
return invoice; // ❌ IDOR
```

### งานของคุณ

1. แก้ให้ผู้ใช้ทั่วไปเห็นได้เฉพาะของตัวเองหรือแผนกตามนโยบาย
2. Admin เห็นได้ทั้งหมด แต่ต้องมี audit log
3. เขียน test แนวคิดด้วยผู้ใช้ 2 คน (A ห้ามเห็นของ B)

---

## เฉลย — วิธีคิด โครงสร้าง และ script

### วิธีคิด

1. **Credential lifecycle:** สิ่งที่ออกไปแล้วต้องถอนได้ — ออกแบบ state สำหรับ refresh/blacklist ตั้งแต่วันแรก
2. **Reuse = breach:** refresh ใช้ซ้ำไม่ใช่ bug เล็ก แต่เป็นสัญญาณขโมย
3. **AuthN แล้วค่อย AuthZ แล้วค่อย Object check**
4. **ABAC เป็นชั้นเสริม** บน RBAC ไม่ใช่แทนที่ทั้งหมดในระบบเล็ก

### โครงสร้างไฟล์เฉลย

```
02-intermediate/lab/solution/
├── token-service.ts
├── refresh-rotation.ts
├── rbac-middleware.ts
├── abac-refund-policy.ts
├── idor-fix.ts
└── NOTES.md
```

### script เฉลย

#### Refresh rotation + reuse detection

```typescript
async function refresh(rawRefresh: string) {
  const hash = sha256(rawRefresh);
  const record = await store.get(hash);

  if (!record) {
    // อาจเป็น token ที่หมุนไปแล้ว → ลองดู family hint ถ้ามี
    throw unauthorized('invalid_grant');
  }

  if (record.revoked || record.used) {
    await store.revokeFamily(record.familyId);
    throw unauthorized('refresh_reuse_detected');
  }

  await store.markUsed(hash);

  const familyId = record.familyId;
  const tokens = await issueTokenPair(record.userId, familyId);
  return tokens;
}
```

#### Blacklist access token on logout

```typescript
async function logout(accessJwt: string, refreshRaw?: string) {
  const payload = verify(accessJwt); // แม้ใกล้หมดอายุก็ blacklist ได้
  const ttl = payload.exp - Math.floor(Date.now() / 1000);
  if (ttl > 0) await blacklist.put(payload.jti, ttl);

  if (refreshRaw) {
    const rec = await store.get(sha256(refreshRaw));
    if (rec) await store.revokeFamily(rec.familyId);
  }
}
```

#### RBAC middleware

```typescript
function requirePermission(needed: string) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'unauthenticated' });
    const perms = expandRolesToPermissions(req.user.roles);
    if (!perms.has(needed) && !perms.has(needed.split(':')[0] + ':*')) {
      return res.status(403).json({ error: 'forbidden' });
    }
    next();
  };
}
```

#### ABAC refund

```typescript
function canRefund(ctx: AuthzContext): boolean {
  const roleOk =
    ctx.subject.roles.includes('finance_manager') ||
    ctx.subject.permissions.includes('invoices:refund');

  const deptOk = ctx.resource.department === ctx.subject.department;
  const amountOk = (ctx.resource.amount ?? Infinity) <= ctx.subject.refundLimit;
  const mfaOk = ctx.subject.mfa === true;
  const hour = ctx.env.now.getHours(); // สมมติแปลงเป็น Bangkok แล้ว
  const timeOk = hour >= 9 && hour < 18;

  return roleOk && deptOk && amountOk && mfaOk && timeOk;
}
```

#### แก้ IDOR

```typescript
async function getInvoice(req, res) {
  const invoice = await db.findById(req.params.id);
  if (!invoice) return res.status(404).json({ error: 'not_found' });

  const isAdmin = req.user.roles.includes('admin');
  const isOwner = invoice.ownerId === req.user.id;
  const sameDept =
    req.user.roles.includes('accountant') && invoice.department === req.user.department;

  if (!isAdmin && !isOwner && !sameDept) {
    // เลือก 404 เพื่อลด enumeration หรือ 403 ตามนโยบายองค์กร
    return res.status(404).json({ error: 'not_found' });
  }

  if (isAdmin) await audit.write({ actor: req.user.id, action: 'invoice.read', id: invoice.id });
  return res.json(invoice);
}
```

### ตารางทดสอบ IDOR

| ผู้เรียก                    | invoice ของ | ผลลัพธ์ที่คาดหวัง |
| --------------------------- | ----------- | ----------------- |
| Alice (owner)               | Alice       | 200               |
| Alice                       | Bob         | 404/403           |
| Accountant แผนกเดียวกับ Bob | Bob         | 200               |
| Accountant คนละแผนก         | Bob         | 404/403           |
| Admin                       | Bob         | 200 + audit       |

---

## Checklist ส่งงาน

- [ ] Rotation + reuse detection ทำงาน
- [ ] Logout ตัด access ผ่าน blacklist จริง
- [ ] RBAC แยก 401/403 ได้
- [ ] ABAC refund ครบเงื่อนไข
- [ ] IDOR ถูกปิดด้วย object-level check

ไปต่อที่ [`../03-expert/`](../03-expert/)
