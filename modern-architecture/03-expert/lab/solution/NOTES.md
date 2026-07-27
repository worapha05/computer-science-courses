# เฉลยวิเคราะห์ — NovaMart Expert

## 1. ทำไม homepage ถึงพังตาม?

Architectural smell: UI/BFF ผูก recommendation เข้ากับ **payment dependency graph** (หรือ shared thread pool / shared client ที่โดน circuit เดียวกันโดยไม่ตั้งใจ)

เมื่อ payment ช้า → retry ระเบิด → resource หมด → เส้นทางที่ไม่เกี่ยวธุรกิจ payment ก็ช้า/พัง
แก้: **bulkhead** คนละ pool, homepage อ่านจาก **cache/read model**, ไม่เรียก payment ใน critical path ของหน้าแรก

## 2. ทำไมต้อง Saga แทน 2PC?

Flash sale ต้องการ latency ต่ำและ availability สูง — 2PC ล็อกข้ามบริการจะทำให้ inventory/payment รอกันและขยาย outage
Saga + compensate สอดคล้องกับ eventual consistency ของอีคอมเมิร์ซ (ยกเลิกจองสต็อก / refund)

## 3. Resilience ที่เลือก

| ชั้น            | เหตุผล                                          |
| --------------- | ----------------------------------------------- |
| Timeout         | กันรอ payment 3s แล้วกิน concurrency            |
| Retry + jitter  | ทน flap ชั่วคราว โดยไม่ stampede                |
| Circuit breaker | fail fast เมื่อ provider พังจริง                |
| Fallback        | โฮมเพจยังขาย/แนะนำของได้แม้ personalization ตาย |

## 4. Observability

War-room ต้องเห็น `correlationId` + `traceId` เดียวกันจาก gateway → inventory → payment → shipping
ลดเวลาหา root cause จาก “เดา” เป็น “ดู span ไหนช้า/error”
