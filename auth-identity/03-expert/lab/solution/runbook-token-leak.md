# Token Leak Runbook — NexBank

1. **Contain:** revoke refresh family และ IdP sessions ของบัญชีที่สงสัย
2. **Rotate:** client secrets / signing keys ถ้ามีหลักฐานว่า confidential material รั่ว
3. **Force step-up:** บังคับ MFA ก่อนทำธุรกรรม
4. **Hunt:** ค้น access logs ด้วย `jti` / IP ที่ผิดปกติ
5. **Eradicate:** ห้าม token ใน query string; ปิด log ของ Authorization header
6. **Recover:** แจ้งผู้ใช้ที่เกี่ยวข้องตามนโยบายองค์กร
7. **Lesson learned:** เพิ่ม CI check ห้าม pattern `access_token=` ใน URL builders
