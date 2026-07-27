# Level 3 — Expert: Federated Identity, OAuth 2.0/OIDC & Security Hardening

> **เป้าหมายระดับนี้:** ออกแบบระบบยืนยันตัวตนแบบองค์กรด้วย OAuth 2.0 + OIDC, เชื่อม IdP (Keycloak), ป้องกัน MFA/SSO และ harden ตาม OWASP API Security พร้อมแนว Zero-Trust ที่ Gateway

---

## สารบัญ

1. [ปรัชญา Enterprise Identity](#1-ปรัชญา-enterprise-identity)
2. [OAuth 2.0 Framework](#2-oauth-20-framework)
3. [Authorization Code + PKCE](#3-authorization-code--pkce)
4. [Client Credentials (M2M)](#4-client-credentials-m2m)
5. [OpenID Connect (OIDC)](#5-openid-connect-oidc)
6. [Enterprise IdP: Keycloak](#6-enterprise-idp-keycloak)
7. [SSO, MFA/TOTP และ Step-up Auth](#7-sso-mfatotp-และ-step-up-auth)
8. [Zero-Trust ที่ API Gateway](#8-zero-trust-ที่-api-gateway)
9. [OWASP API Threat Mitigation](#9-owasp-api-threat-mitigation)
10. [Best Practices](#10-best-practices)
11. [โครงสร้างโค้ดตัวอย่าง](#11-โครงสร้างโค้ดตัวอย่าง)

---

## 1. ปรัชญา Enterprise Identity

ในองค์กรขนาดใหญ่ แอปไม่ควรเป็น “แหล่งความจริง” ของรหัสผ่านเองทั้งหมด แต่ควร:

1. **Federate** การยืนยันตัวตนไปยัง Identity Provider (IdP)
2. **Centralize** นโยบาย MFA, password policy, session, audit
3. **Delegate** การออก token ตามมาตรฐาน (OAuth/OIDC)
4. **Verify continuously** ที่ขอบเขต (Gateway) แบบ Zero-Trust — ไม่เชื่อเครือข่ายภายใน

```
User / App → IdP (Keycloak/Auth0) → Access Token / ID Token
     ↓
    API Gateway (verify JWT, scopes, threat signals)
     ↓
    Downstream services (fine-grained AuthZ)
```

---

## 2. OAuth 2.0 Framework

OAuth 2.0 คือกรอบการ **มอบสิทธิ์ (authorization delegation)** ไม่ใช่โปรโตคอล login โดยตรง

### บทบาทหลัก

| บทบาท                    | หน้าที่                        |
| ------------------------ | ------------------------------ |
| **Resource Owner**       | ผู้ใช้เจ้าของข้อมูล            |
| **Client**               | แอปที่ขอเข้าถึง                |
| **Authorization Server** | ออก authorization code / token |
| **Resource Server**      | API ที่ถือข้อมูล               |

### Grant Types ที่ยังควรใช้

| Grant                         | ใช้เมื่อ                     | หมายเหตุ            |
| ----------------------------- | ---------------------------- | ------------------- |
| **Authorization Code + PKCE** | SPA, Mobile, Web app มี user | **มาตรฐานปัจจุบัน** |
| **Client Credentials**        | Machine-to-machine           | ไม่มี user context  |
| Device Code                   | TV / CLI                     | UX จำกัด input      |
| Refresh Token                 | ต่ออายุ session              | ต้องหมุนและปกป้อง   |

### Grant ที่เลิกแนะนำ

- **Implicit** — token ใน URL fragment, ไม่มี client auth ที่ดี
- **Resource Owner Password Credentials** — แอปเห็นรหัสผ่านผู้ใช้

---

## 3. Authorization Code + PKCE

### ทำไมต้อง PKCE?

SPA/Mobile เก็บ `client_secret` ไม่ได้ปลอดภัย
PKCE (Proof Key for Code Exchange) ผูก authorization code กับ client ที่เริ่ม flow ด้วย `code_verifier`

### Flow สรุป

```
1) Client สร้าง code_verifier (สุ่ม) และ code_challenge = BASE64URL(SHA256(verifier))
2) Browser redirect ไป /authorize?response_type=code&code_challenge=...&code_challenge_method=S256
3) ผู้ใช้ login / consent ที่ IdP
4) IdP redirect กลับพร้อม ?code=...
5) Client แลก code + code_verifier ที่ /token
6) ได้ access_token (+ refresh_token, + id_token ถ้า OIDC)
```

### parameter สำคัญ

| parameter      | ความหมาย                                        |
| -------------- | ----------------------------------------------- |
| `client_id`    | ระบุแอป                                         |
| `redirect_uri` | ต้องตรงกับที่ลงทะเบียนแบบ exact match           |
| `scope`        | สิทธิ์ที่ขอ เช่น `openid profile invoices:read` |
| `state`        | ต้าน CSRF บน redirect                           |
| `nonce`        | ต้าน replay บน id_token (OIDC)                  |

### ช่องโหว่ถ้าทำผิด

- `redirect_uri` แบบเปิดกว้าง → authorization code ถูกส่งไป domain attacker
- ไม่ตรวจ `state` → CSRF login
- ใช้ `code_challenge_method=plain` โดยไม่จำเป็น

---

## 4. Client Credentials (M2M)

ใช้เมื่อ service A เรียก service B โดยไม่มีผู้ใช้ เช่น job, webhook processor

```
POST /token
 grant_type=client_credentials
 client_id=...
 client_secret=...
 scope=invoices:sync
```

Best practices:

- ใช้ secret หมุนได้ หรือ mTLS / private_key_jwt
- Scope แคบมาก
- ไม่ผสม user token กับ client token โดยไม่แยก audience

---

## 5. OpenID Connect (OIDC)

OIDC เป็น **identity layer** บน OAuth 2.0

| Token            | ใครใช้                      | มีอะไร                                           |
| ---------------- | --------------------------- | ------------------------------------------------ |
| **ID Token**     | Client ใช้ยืนยันตัวตนผู้ใช้ | `sub`, `iss`, `aud`, `nonce`, `auth_time`, `acr` |
| **Access Token** | ส่งให้ Resource Server      | scopes / roles ตามออกแบบ                         |
| **UserInfo**     | Client ดึงโปรไฟล์เพิ่ม      | endpoint มาตรฐาน                                 |

### การ verify ID Token

1. ดึง JWKS จาก IdP (`/.well-known/openid-configuration` → `jwks_uri`)
2. ตรวจลายเซ็น (RS256/ES256)
3. ตรวจ `iss`, `aud`, `exp`, `nonce`
4. **อย่า** ส่ง id_token ไปเป็น credential ของ API (ใช้ access token)

### Discovery document

```
GET https://idp.example/.well-known/openid-configuration
```

ได้ `authorization_endpoint`, `token_endpoint`, `jwks_uri`, `userinfo_endpoint`

---

## 6. Enterprise IdP: Keycloak

Keycloak เป็น OSS Identity Provider ที่นิยมในองค์กร

แนวคิดหลัก:

| แนวคิด                         | ความหมาย                                 |
| ------------------------------ | ---------------------------------------- |
| **Realm**                      | ขอบเขต tenant ของ users/clients/roles    |
| **Client**                     | แอปที่ลงทะเบียน (public/confidential)    |
| **Identity Brokering**         | login ผ่าน Google/AD แล้ว map เข้า realm |
| **Realm roles / Client roles** | แหล่ง claims ใน token                    |

ตัวอย่าง config อยู่ใน `src/keycloak/` — รวม docker-compose snippet และ client settings สำหรับ PKCE

---

## 7. SSO, MFA/TOTP และ Step-up Auth

### SSO (Single Sign-On)

ผู้ใช้ login ที่ IdP ครั้งเดียว แล้วเข้าหลายแอปผ่าน session ของ IdP
ออกจากระบบแบบรวม = **SLO (Single Logout)** — ต้องออกแบบให้ครบทั้ง front-channel/back-channel

### MFA / TOTP

Time-based One-Time Password (RFC 6238):

1. Server สร้าง secret แล้วแสดงเป็น QR (otpauth URI)
2. Authenticator app สร้างรหัส 6 หลักทุก 30 วินาที
3. Server ตรวจด้วยหน้าต่างเวลา (skew ±1 step)

เก็บ TOTP secret แบบเข้ารหัสที่ rest และบังคับ MFA สำหรับ action อ่อนไหว

### Step-up authentication

แม้มี session อยู่แล้ว ถ้าจะโอนเงิน/เปลี่ยนอีเมล → ขอ MFA ใหม่ และตรวจ claim `acr` / `amr` ใน token

---

## 8. Zero-Trust ที่ API Gateway

หลัก Zero-Trust: **never trust, always verify**

ที่ Gateway ควรตรวจอย่างน้อย:

1. JWT signature + `iss`/`aud`/`exp`
2. Token revocation / introspection (ถ้าจำเป็น)
3. Required scopes / roles
4. mTLS ระหว่าง services (optional แต่แข็งแรง)
5. Rate limit / anomaly (IP reputation, burst)
6. Context signals: device, geo, risk score

```
Internet → WAF → API Gateway (AuthN/AuthZ coarse) → Service Mesh (mTLS)
       ↓
    Fine-grained ABAC ใน service
```

---

## 9. OWASP API Threat Mitigation

| ความเสี่ยง                | แนวทางในระบบ Identity                                                                           |
| ------------------------- | ----------------------------------------------------------------------------------------------- |
| **XSS**                   | HttpOnly cookies, CSP, ไม่เก็บ token ใน localStorage ถ้าเลี่ยงได้                               |
| **CSRF**                  | SameSite, anti-CSRF token, อย่าใช้ cookie อย่างเดียวโดยไม่มี synchronizer สำหรับ state-changing |
| **Token Leakage**         | ไม่ใส่ token ใน query string/logs, ใช้ short TTL, rotate                                        |
| **Replay**                | `nonce`, `jti` + one-time use, `iat`/`nbf`/`exp` แน่น                                           |
| **Broken Object AuthZ**   | object-level checks (เรียนใน Intermediate)                                                      |
| **Broken Function AuthZ** | deny-by-default + centralized permission                                                        |
| **Security Misconfig**    | ปิด debug, บังคับ HTTPS, ตั้ง CORS แคบ                                                          |

### รายละเอียด CSRF vs JWT ใน Header

ถ้าระบบส่ง access token ผ่าน `Authorization` header ที่ JS ใส่เอง (ไม่ใช่ cookie อัตโนมัติ) จะต้าน CSRF ได้ดีโดยธรรมชาติ แต่ต้อง harden XSS ให้ดีเพราะ XSS จะขโมย token จาก memory/storage ได้

---

## 10. Best Practices

1. ใช้ Authorization Code + PKCE สำหรับ user apps
2. ใช้ Client Credentials สำหรับ M2M พร้อม secret rotation
3. Validate `redirect_uri` แบบ exact allow-list
4. ตรวจ `state` และ `nonce` เสมอ
5. แยก id_token กับ access_token ตามหน้าที่
6. บังคับ MFA สำหรับ privileged roles และ step-up สำหรับ sensitive actions
7. Gateway ตรวจ JWT/JWKS แบบ cache + key rotation aware
8. ไม่ log authorization headers
9. ออกแบบ SLO และ session timeout ของ IdP ให้สอดคล้องแอป
10. Threat model เป็นระยะ — โดยเฉพาะ XSS ซึ่งเป็น root cause ของ token theft บ่อยครั้ง

---

## 11. โครงสร้างโค้ดตัวอย่าง

```
03-expert/
├── README.md
├── LAB.md
└── src/
 ├── index.ts     ← demo รวม OAuth PKCE + MFA + gateway checks
 ├── oauth/
 │ ├── pkce.ts
 │ ├── auth-code-flow.ts
 │ └── client-credentials.ts
 ├── oidc/
 │ ├── discovery.ts
 │ └── id-token.ts
 ├── mfa/
 │ └── totp.ts
 ├── gateway/
 │ └── zero-trust.ts
 ├── hardening/
 │ ├── csrf.ts
 │ └── security-headers.ts
 └── keycloak/
  ├── docker-compose.yml
  └── realm-export.json
```

### รันตัวอย่าง

```bash
cd auth-identity-bootcamp
npm install
npm run expert:demo

# (optional) เปิด Keycloak
npm run docker:up
# Admin console: http://localhost:8080 admin / admin
```

---

## สิ่งที่ต้องทำได้เมื่อจบ Expert

- วาด sequence diagram ของ Authorization Code + PKCE ได้จากหน่วยความจำ
- อธิบายความต่าง access token / id_token / refresh token
- ตั้งค่า Keycloak client แบบ public + PKCE
- Implement TOTP enroll + verify
- วาง Gateway policy แบบ Zero-Trust ร่วมกับ fine-grained AuthZ ใน service
