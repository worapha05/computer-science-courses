# เฉลยคำถามคิด — FoodDash Intermediate

## Cold start สำหรับ `POST /orders`

- แยก function เล็ก: รับออเดอร์แล้ว enqueue อย่างเดียว — init น้อย
- ใช้ provisioned concurrency / min instances เฉพาะ accept path ที่ลูกค้ารอ
- Worker / payment function ยอม cold ได้มากกว่า เพราะเป็น async
- ลดขนาดแพ็กเกจ: ไม่ import SDK ใหญ่ใน accept handler
- Cache secret ใน warm worker ไม่ดึงทุก job ถ้าไม่จำเป็น (ระวัง rotation)

## 1. ทำไม monolith ถึงล่มทั้งระบบเมื่อ payment ช้า?

Thread/connection pool ถูกบล็อกด้วย sync call ไป provider → request อื่น (รวมเมนูร้าน) รอ resource ใน process เดียวกัน → latency พุ่งแล้ว timeout ทั้งแอป

## 2. อะไรยังควรตอบได้ตอน payment พัง?

`GET /restaurants` และสถานะออเดอร์ที่มีอยู่ควรยังเสิร์ฟได้
ออเดอร์ใหม่อาจ `accepted` แล้วค้าง `processing`/`failed` โดยไม่ทำให้ catalog พัง

## 3. Sync หรือ Async สำหรับ charge?

**Async (คิว)** เหมาะกว่าสำหรับ FoodDash: ลูกค้าได้ 202 เร็ว, payment ช้าไม่กิน thread ของ API, มีที่สำหรับ retry/DLQ
ใช้ sync เฉพาะเมื่อธุรกิจบังคับให้รู้ผลก่อนจบหน้าจอ และมี timeout/circuit breaker เข้มงวด
