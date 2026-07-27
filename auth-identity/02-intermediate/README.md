# Level 2 — Intermediate: Token Lifecycles & Granular Access Control

> **เป้าหมายระดับนี้:** ออกแบบ Access/Refresh Token แบบปลอดภัย พร้อม rotation/revocation และ implement RBAC + ABAC รวมถึงป้องกัน IDOR ที่ชั้น API

---

## สารบัญ

1. [ปรัชญา: Credentials ต้องมีอายุและถอนได้](#1-ปรัชญา-credentials-ต้องมีอายุและถอนได้)
2. [Advanced JWT Architecture](#2-advanced-jwt-architecture)
3. [Token Rotation & Revocation](#3-token-rotation--revocation)
4. [Access Control Models](#4-access-control-models)
5. [RBAC ใน Middleware](#5-rbac-ใน-middleware)
6. [ABAC: การประเมินสิทธิ์เชิงบริบท](#6-abac-การประเมินสิทธิ์เชิงบริบท)
7. [Securing API Endpoints](#7-securing-api-endpoints)
8. [ป้องกัน IDOR](#8-ป้องกัน-idor)
9. [ช่องโหว่และ Best Practices](#9-ช่องโหว่และ-best-practices)
10. [โครงสร้างโค้ดตัวอย่าง](#10-โครงสร้างโค้ดตัวอย่าง)

---

## 1. ปรัชญา: Credentials ต้องมีอายุและถอนได้

ใน Beginner เราเรียนรู้ว่า JWT แบบยาว ๆ อย่างเดียวมีปัญหา: **ถ้า token รั่ว จะใช้ได้นาน** และ **revoke ยาก**

หลักออกแบบระดับ Intermediate:

| หลักการ                     | การนำไปใช้                                               |
| --------------------------- | -------------------------------------------------------- |
| **Short-lived access**      | Access token 5–15 นาที                                   |
| **Rotating refresh**        | Refresh token ใช้ครั้งเดียวแล้วออกคู่ใหม่                |
| **Server-side revoke list** | เก็บ `jti` / family id ใน Redis                          |
| **Least privilege**         | Role/permission แคบที่สุด                                |
| **Object-level authz**      | ตรวจความเป็นเจ้าของทุกครั้ง ไม่เชื่อ `userId` จาก client |

---

## 2. Advanced JWT Architecture

### 2.1 Access Token vs Refresh Token

```
┌─────────────┐ short TTL ┌─────────────┐
│ Client │◄──────────────►│ API / GW │ verify signature + claims
└──────┬──────┘ Access JWT └─────────────┘
  │
  │ refresh (เมื่อ access หมดอายุ)
  ▼
┌─────────────┐ long TTL  ┌─────────────┐
│ Auth Server │◄──────────────►│ Token Store │ hash(refresh), family, revoked
└─────────────┘ Refresh  └─────────────┘
```

|                        | Access Token          | Refresh Token                       |
| ---------------------- | --------------------- | ----------------------------------- |
| วัตถุประสงค์           | เรียก API             | ขอ access ใหม่                      |
| อายุ                   | สั้น (นาที)           | ยาว (วัน–สัปดาห์)                   |
| เก็บที่ไหน             | memory / short cookie | httpOnly cookie หรือ secure storage |
| ใส่ role/scope?        | ได้ (เล็กน้อย)        | ไม่จำเป็นต้องใส่สิทธิ์ละเอียด       |
| ส่งไป resource server? | ใช่                   | **ไม่** — ส่งเฉพาะไป token endpoint |

### 2.2 Claims ที่แนะนำสำหรับ Access Token

```json
{
  "sub": "user-42",
  "sid": "session-family-abc",
  "jti": "atk_01H...",
  "roles": ["editor"],
  "permissions": ["posts:read", "posts:write"],
  "iss": "https://auth.shopsecure.local",
  "aud": "https://api.shopsecure.local",
  "iat": 1710000000,
  "exp": 1710000900
}
```

- `jti` — ใช้ blacklist ราย token
- `sid` / `family` — ใช้ revoke ทั้งกลุ่มเมื่อ detect reuse

---

## 3. Token Rotation & Revocation

### 3.1 Refresh Token Rotation

Flow ที่ปลอดภัย:

1. Client ส่ง refresh token ที่ยัง valid
2. Server **ตรวจว่ายังไม่ถูกใช้/revoke**
3. Server **invalidate ของเก่าทันที**
4. ออก access + refresh คู่ใหม่
5. ถ้าพบว่า refresh เก่าถูกใช้ซ้ำ → **compromise detected** → revoke ทั้ง family

```
Refresh_v1 ──ใช้──► ออก Access_2 + Refresh_v2 และทำเครื่องหมาย v1 = used
Refresh_v1 ──ใช้ซ้ำ──► ALERT: ขโมย token → revoke family ทั้งหมด
```

### 3.2 Blacklisting / Revocation ผ่าน Cache

เนื่องจาก JWT เป็น stateless การ revoke ต้องมี state บางส่วน:

| วิธี                      | รายละเอียด                       | ข้อดี                 | ข้อเสีย                                  |
| ------------------------- | -------------------------------- | --------------------- | ---------------------------------------- |
| **jti blacklist**         | เก็บ jti ที่ revoke จนถึง `exp`  | ละเอียด               | ต้อง lookup ทุก request                  |
| **user tokenVersion**     | เก็บ version ใน DB; JWT มี `ver` | revoke ทั้ง user ง่าย | ต้องอ่าน version                         |
| **refresh family revoke** | ตัด refresh ทั้งหมดของ session   | ดีต่อ hijack          | access ที่ยังไม่หมดอายุยังใช้ได้ชั่วคราว |

**แนวทางผสมที่นิยม:** access สั้นมาก + refresh rotation + family revoke

### 3.3 ที่เก็บข้อมูล

- Redis: `SET refresh:{hash} {familyId} EX {ttl}` และ `SET blacklist:{jti} 1 EX {ttlRemaining}`
- เก็บ **hash ของ refresh token** ไม่เก็บ plaintext

---

## 4. Access Control Models

### 4.1 RBAC — Role-Based Access Control

ผูกสิทธิ์ผ่าน **บทบาท (Role)**

```
User ──► Roles ──► Permissions ──► Actions on Resources
```

ตัวอย่าง:

| Role     | Permissions                   |
| -------- | ----------------------------- |
| `viewer` | `orders:read`                 |
| `editor` | `orders:read`, `orders:write` |
| `admin`  | `orders:*`, `users:*`         |

**Hierarchical RBAC:** `admin` ⊇ `editor` ⊇ `viewer`
ต้องระวัง role explosion และการให้ role กว้างเกินไป

### 4.2 ABAC — Attribute-Based Access Control

ตัดสินจาก **attributes** ของ:

- **Subject:** แผนก, ระดับ clearance, verified email
- **Resource:** ownerId, classification, tenantId
- **Action:** read / write / delete / approve
- **Environment:** เวลา, IP range, device posture, MFA strength

ตัวอย่างนโยบาย:

> อนุญาต `orders:refund` ถ้า
> `subject.role == finance` และ
> `resource.amount <= subject.refundLimit` และ
> `environment.mfa == true` และ
> `time.hour between 9 and 18`

ABAC ยืดหยุ่นกว่า แต่ policy ซับซ้อนและต้องทดสอบดี

### 4.3 เมื่อไหร่ใช้อะไร

| สถานการณ์                               | แนะนำ                           |
| --------------------------------------- | ------------------------------- |
| สิทธิ์ตามตำแหน่งงานชัดเจน               | RBAC                            |
| ต้องแยกตามเจ้าของข้อมูล / tenant / เวลา | ABAC หรือ RBAC+ownership checks |
| API ภายนอก / third-party                | OAuth scopes (+ RBAC ภายใน)     |

---

## 5. RBAC ใน Middleware

Pipeline ที่แนะนำ:

```
Request
 → authenticate (401 ถ้าไม่ผ่าน)
 → load roles/permissions
 → authorize permission (403 ถ้าไม่ผ่าน)
 → object-level check / ABAC
 → handler
```

```typescript
app.get('/admin/users', requireAuth, requirePermission('users:read'), listUsers);
```

**อย่า** ใส่ role check แบบกระจายใน handler โดยไม่มีมาตรฐานกลาง — จะหลุดช่องโหว่

---

## 6. ABAC: การประเมินสิทธิ์เชิงบริบท

รูปแบบ policy engine อย่างง่าย:

```typescript
type Decision = 'Allow' | 'Deny';

interface AuthzContext {
  subject: { id: string; roles: string[]; department?: string; mfa: boolean };
  resource: { type: string; ownerId: string; tenantId: string; amount?: number };
  action: string;
  env: { ip: string; now: Date };
}

function evaluate(policy: Policy, ctx: AuthzContext): Decision;
```

เริ่มจาก deny-by-default แล้ว allow เมื่อครบเงื่อนไข

---

## 7. Securing API Endpoints

### 7.1 401 vs 403

| Status | ความหมาย                                | ตัวอย่าง                   |
| ------ | --------------------------------------- | -------------------------- |
| 401    | ไม่รู้ว่าเป็นใคร / credential ใช้ไม่ได้ | ไม่มี token, token หมดอายุ |
| 403    | รู้ว่าเป็นใครแล้ว แต่ห้ามทำ             | user ธรรมดาเรียก `/admin`  |

การปนกันทำให้ client และ monitoring สับสน และอาจเปิดช่อง enumeration

### 7.2 Generic Auth Middleware

คุณสมบัติที่ควรมี:

1. ดึง credential จาก `Authorization` หรือ cookie ตามที่ออกแบบ
2. Verify ลายเซ็น / session
3. ตรวจ blacklist
4. แนบ `req.user` ที่เชื่อถือได้
5. ไม่ leak รายละเอียด crypto error ให้ client

---

## 8. ป้องกัน IDOR

**IDOR (Insecure Direct Object Reference)** คือช่องโหว่ที่ผู้ใช้เปลี่ยน id ใน URL/body แล้วเข้าถึง object ของคนอื่นได้

```
GET /orders/1001 ← Alice เป็นเจ้าของ
GET /orders/1002 ← ของ Bob — ถ้าไม่มี object check จะรั่ว
```

### วิธีป้องกัน

1. **Always authorize on object load:** `WHERE id = ? AND owner_id = ?`
2. ใช้ **indirect reference** (UUID แบบยากเดา) ช่วยได้บางส่วน แต่ **ไม่แทน** authz
3. สำหรับ admin ที่ข้าม ownership ได้ ต้องมี permission ชัดเจน + audit log
4. ทดสอบด้วยผู้ใช้ 2 คนเสมอ (horizontal privilege escalation)

---

## 9. ช่องโหว่และ Best Practices

### ช่องโหว่ที่พบบ่อย

| ช่องโหว่                                        | รายละเอียด                  |
| ----------------------------------------------- | --------------------------- |
| Refresh token ไม่หมุน                           | ถูกขโมยแล้วยังใช้ได้นาน     |
| เก็บ refresh ใน localStorage                    | XSS ขโมยง่าย                |
| เชื่อ `userId` จาก body                         | IDOR / privilege escalation |
| Role อยู่ใน JWT แต่ไม่ validate ตอนเปลี่ยน role | สิทธิ์ค้าง                  |
| ใช้ 404 แทน 403 แบบไม่สม่ำเสมอ                  | อาจช่วย enumerate resource  |

### Best Practices

1. Access token สั้น + refresh rotation + family revoke
2. Hash refresh token ก่อนเก็บ
3. Blacklist `jti` เมื่อ logout / password change
4. Centralize permission checks
5. Deny by default
6. Object-level authorization ทุก resource endpoint
7. Audit log สำหรับ admin actions และ revoke events
8. แยก 401/403 ให้ถูกต้อง
9. ทดสอบ horizontal และ vertical privilege escalation
10. อย่าใส่ PII sensitive ใน JWT

---

## 10. โครงสร้างโค้ดตัวอย่าง

```
02-intermediate/
├── README.md
├── LAB.md
└── src/
 ├── index.ts
 ├── auth/
 │ ├── tokens.ts   ← access + refresh issue/verify
 │ ├── refresh-store.ts ← rotation + reuse detection
 │ └── blacklist.ts  ← jti blacklist (cache)
 ├── access-control/
 │ ├── rbac.ts
 │ ├── abac.ts
 │ └── permissions.ts
 ├── middleware/
 │ ├── authenticate.ts
 │ ├── require-permission.ts
 │ └── require-object-access.ts
 └── utils/
  └── hash.ts
```

### รันตัวอย่าง

```bash
cd auth-identity-bootcamp
npm install
npm run intermediate:demo
```

```bash
# login → ได้ access + refresh
curl -X POST http://localhost:3002/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"editor@shop.test","password":"password123"}'

# เรียก API ด้วย access token
curl http://localhost:3002/orders \
  -H "Authorization: Bearer <accessToken>"

# refresh
curl -X POST http://localhost:3002/auth/refresh \
  -H 'Content-Type: application/json' \
  -d '{"refreshToken":"<refreshToken>"}'
```

---

## สิ่งที่ต้องพกไประดับ Expert

- ทำไม Authorization Code + PKCE ดีกว่า Implicit
- ความต่างระหว่าง OAuth access token กับ OIDC id_token
- วิธีวาง Zero-Trust checks ที่ API Gateway ร่วมกับ IdP
