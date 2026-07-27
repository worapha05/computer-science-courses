# Lab — Expert: OAuth/OIDC, Token Leakage, MFA และ Zero-Trust Gateway

> สถานการณ์ระดับองค์กร — ออกแบบให้ผ่าน security review ได้

---

## สถานการณ์จำลอง

องค์กร **NexBank** กำลังย้ายจาก login ในแต่ละแอป ไปใช้ **Keycloak** เป็น IdP กลาง

ข้อกำหนด:

1. Web SPA ใช้ OAuth 2.0 Authorization Code + PKCE
2. Batch service ใช้ Client Credentials
3. การโอนเงินต้อง MFA (TOTP) แบบ step-up
4. API Gateway ตรวจ JWT ตามแนว Zero-Trust
5. ต้องปิดช่องโหว่ Token Leakage / Replay / CSRF / XSS impact

---

## Lab 3.1 — ออกแบบ Login ด้วย PKCE

### โจทย์

เขียน module ที่:

1. สร้าง `code_verifier` / `code_challenge` (S256)
2. สร้าง authorize URL พร้อม `state`, `nonce`, `scope=openid profile transfer:write`
3. แลก `code` เป็น tokens ที่ token endpoint (mock ได้)
4. ตรวจว่า `state` ตรงกับที่เก็บใน session ฝั่ง client/backend BFF

### เกณฑ์ผ่าน

- [ ] challenge = BASE64URL(SHA256(verifier))
- [ ] reject เมื่อ state ไม่ตรง
- [ ] ไม่มี client_secret ใน SPA bundle

---

## Lab 3.2 — แยก ID Token กับ Access Token

### โจทย์

1. Verify ID Token: `iss`, `aud`, `exp`, `nonce`
2. ใช้ Access Token เท่านั้นตอนเรียก API
3. อธิบายใน NOTES ว่าทำไมส่ง id_token ให้ API เป็น anti-pattern

---

## Lab 3.3 — MFA/TOTP สำหรับ Step-up

### โจทย์

Flow:

```
POST /mfa/enroll  → ได้ otpauth:// URI + secret (แสดงครั้งเดียว)
POST /mfa/verify  → ยืนยันรหัส 6 หลัก
POST /transfers  → ต้องมี claim/session ว่า mfa ผ่านภายใน 5 นาที
```

กัน replay: รหัส TOTP ใช้แล้วซ้ำในหน้าต่างเวลาเดียวกันไม่ได้

---

## Lab 3.4 — แก้ Token Leakage & Replay (สถานการณ์จริง)

### เหตุการณ์

นักพัฒนาใส่ access token ใน query string เพื่อแชร์ link debug:

```
GET /callback?access_token=eyJhbGciOi...
```

Token หลุดใน:

- Browser history
- Reverse proxy access logs
- Referer header ไปยัง third-party CDN

### งานของคุณ

1. ออกแบบ callback ให้รับแค่ `code` (+ `state`) ห้าม token ใน URL
2. ใส่ anti-replay สำหรับ transfer API ด้วย `jti` หรือ idempotency key
3. ตั้ง security headers (CSP, Referrer-Policy) ที่ช่วยลดผลกระทบ
4. เขียน runbook สั้น ๆ เมื่อสงสัยว่า token รั่ว

---

## Lab 3.5 — Zero-Trust Gateway Policy

### โจทย์

เขียน Gateway middleware ที่ **deny by default** และ allow เมื่อครบ:

| ตรวจ    | เงื่อนไข                                   |
| ------- | ------------------------------------------ |
| JWT     | signature + iss + aud + exp                |
| Scope   | มี `transfer:write` สำหรับ POST /transfers |
| ACR/MFA | `acr` ≥ `2` หรือ flag `mfa_recent=true`    |
| Risk    | block ถ้า IP อยู่ใน deny list demo         |
| Replay  | `jti` ยังไม่ถูกใช้                         |

---

## เฉลย — วิธีคิด โครงสร้าง และ script

### วิธีคิด

1. **Browser เป็น hostile environment** — อย่าฝาก secret ยาว ๆ
2. **Code ใน redirect แลกที่ back channel** — ลด leakage จาก URL
3. **Step-up ≠ login ครั้งเดียว** — action อ่อนไหวต้อง freshness ของ MFA
4. **Gateway = coarse filter, Service = fine AuthZ** — อย่าพึ่งชั้นเดียว

### โครงสร้างไฟล์เฉลย

```
03-expert/lab/solution/
├── pkce-login.ts
├── oidc-verify.ts
├── totp-stepup.ts
├── leakage-hardening.ts
├── gateway-policy.ts
├── runbook-token-leak.md
└── NOTES.md
```

### script เฉลย

#### PKCE

```typescript
import { createHash, randomBytes } from 'crypto';

export function generatePkce() {
  const verifier = randomBytes(32).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge, method: 'S256' as const };
}
```

#### Authorize URL

```typescript
const url = new URL(`${issuer}/protocol/openid-connect/auth`);
url.searchParams.set('client_id', clientId);
url.searchParams.set('response_type', 'code');
url.searchParams.set('redirect_uri', redirectUri);
url.searchParams.set('scope', 'openid profile transfer:write');
url.searchParams.set('state', state);
url.searchParams.set('nonce', nonce);
url.searchParams.set('code_challenge', challenge);
url.searchParams.set('code_challenge_method', 'S256');
```

#### TOTP verify + anti-replay

```typescript
const code = authenticator.generate(secret);
const ok = authenticator.check(userCode, secret); // window ±1
if (!ok) throw forbidden();
const key = `${userId}:${userCode}:${timeStep}`;
if (await usedCodes.has(key)) throw replay();
await usedCodes.put(key, 90); // seconds
```

#### Gateway Zero-Trust

```typescript
function gatewayAuthorize(req, jwtPayload, routePolicy) {
  if (denyIps.has(req.ip)) return deny('risk_ip');
  if (jwtPayload.iss !== expectedIss) return deny('bad_iss');
  if (jwtPayload.aud !== expectedAud) return deny('bad_aud');
  if (!scopes(jwtPayload).has(routePolicy.scope)) return deny('scope');
  if (routePolicy.requiresMfa && !freshMfa(jwtPayload)) return deny('step_up');
  if (await jtiStore.seen(jwtPayload.jti)) return deny('replay');
  await jtiStore.mark(jwtPayload.jti, ttl(jwtPayload));
  return allow();
}
```

#### Runbook: สงสัย token รั่ว

1. Revoke refresh family / logout ทุก session ของผู้ใช้
2. หมุน client secrets ที่เกี่ยวข้อง (ถ้าเป็น confidential client)
3. บังคับ step-up MFA และ reset session IdP
4. ตรวจ access log หาการใช้ token จาก IP ผิดปกติ
5. ปิดช่องทางที่ทำให้หลุด (query string logging, verbose error)
6. Postmortem: ทำไม token ถึงไปอยู่ใน URL/log ได้

### NOTES — ทำไมห้ามส่ง id_token ให้ API

- `aud` ของ id_token คือ **client** ไม่ใช่ resource server
- id_token ออกแบบให้ client ยืนยันตัวตนผู้ใช้ ไม่ได้เป็น capability token ของ API
- การรับ id_token ที่ API เปิดช่องสับสน audience และอาจถูกใช้ผิดแบบ confused deputy

---

## Checklist ส่งงาน

- [ ] PKCE flow ครบ + state/nonce
- [ ] แยก verify id_token / ใช้ access_token ถูกที่
- [ ] TOTP enroll + step-up + anti-replay
- [ ] Callback ไม่มี token ใน query
- [ ] Gateway policy ครบตาราง Lab 3.5
- [ ] มี runbook ตอน token รั่ว

ยินดีด้วย — คุณจบเส้นทาง Zero to Expert ของ Authentication & Authorization แล้ว
