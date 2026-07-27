# Keycloak local setup (Expert)

## Quick start

จาก root ของ bootcamp:

```bash
npm run docker:up
```

- Admin console: http://localhost:8080
- User: `admin` / `admin`
- Realm ที่ import: `nexbank`
- SPA client: `nexbank-spa` (public + PKCE S256)
- M2M client: `nexbank-batch` (confidential, secret ในไฟล์ export — **เปลี่ยนก่อนใช้จริง**)

## Issuer URL

```
http://localhost:8080/realms/nexbank
```

Discovery:

```
http://localhost:8080/realms/nexbank/.well-known/openid-configuration
```

## Checklist การตั้งค่า Client (ถ้าสร้างเองใน UI)

1. Access Type / Capability: **Public** สำหรับ SPA
2. Standard Flow: ON
3. Direct Access Grants: OFF
4. Implicit Flow: OFF
5. Valid Redirect URIs: exact match เท่านั้น
6. PKCE: S256
7. Web Origins: domain SPA เท่านั้น ไม่ใช้ `*` ใน production

## หมายเหตุความปลอดภัย

ไฟล์ `realm-export.json` มีรหัสผ่านตัวอย่างสำหรับ lab เท่านั้น
ห้ามใช้ secret/password เหล่านี้ในสภาพแวดล้อมจริง
