# Expert Lab Solution Notes

อ้างอิง:

- PKCE: `src/oauth/pkce.ts`, `src/oauth/auth-code-flow.ts`
- OIDC id_token: `src/oidc/id-token.ts`
- TOTP + replay: `src/mfa/totp.ts`
- Zero-Trust gateway: `src/gateway/zero-trust.ts`
- Hardening: `src/hardening/*`
- Keycloak: `src/keycloak/`

## ทำไมห้ามส่ง id_token ให้ API

`aud` ของ id_token คือ client ไม่ใช่ resource server — ใช้ access token เท่านั้นตอนเรียก API

## Runbook สรุปเมื่อ token รั่ว

1. Revoke sessions / refresh family
2. บังคับ MFA step-up
3. ตรวจ access log
4. ปิดช่องทาง query-string / verbose logs
5. Postmortem
