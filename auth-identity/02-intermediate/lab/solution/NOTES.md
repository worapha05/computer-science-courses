# Intermediate Lab Solution Notes

อ้างอิง implementation:

- Rotation / reuse: `src/auth/refresh-store.ts`, `src/auth/tokens.ts`
- Blacklist: `src/auth/blacklist.ts`
- RBAC: `src/access-control/rbac.ts` + `src/middleware/require-permission.ts`
- ABAC refund + IDOR: `src/access-control/abac.ts` + `src/middleware/require-object-access.ts`

หลักคิด: refresh reuse = breach signal → revoke ทั้ง family
