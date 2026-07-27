# Beginner Lab Solution Notes

ดูโค้ดอ้างอิงหลักใน `01-beginner/src/`

- Password: `src/auth/password.ts`
- Anti-fixation + UA binding: `src/index.ts` + `src/middleware/require-session.ts`
- JWT HS256: `src/auth/jwt.ts`

Residual risk หลัง harden cookie: XSS ยังอันตรายต่อ UX อื่น — ต้องมี CSP และ step-up สำหรับ action อ่อนไหว
