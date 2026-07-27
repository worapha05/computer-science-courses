# Lab ระดับ Intermediate — ย้าย “FoodDash” จาก Monolith สู่ Gateway + DB-per-service

## เป้าหมาย

ออกแบบและลงมือทำ POC สำหรับ **FoodDash** (แอปสั่งอาหาร):

- แยก **Restaurant**, **Order**, **Payment** เป็นบริการย่อย
- ใช้ **API Gateway** เป็นทางเข้าเดียว + access log
- สื่อสารผสม **sync** (อ่านสถานะ) และ **async** (สร้างออเดอร์)
- จัดการ secret ของ payment provider ผ่าน Secret Manager จำลอง
- เขียนแผนรับมือ **cold start** และสถานการณ์ระบบล่ม

ทำด้วยตัวเองก่อน แล้วค่อยเทียบกับ [`lab/solution/`](./lab/solution/)

---

## กรณีศึกษา

FoodDash รัน monolith + MySQL ก้อนเดียว
คืนวันศุกร์: payment provider ช้า → thread pool เต็ม → **ทั้งแอปรวมเมนูร้านก็ล่ม** (cascading)

CTO สั่ง migration ระยะที่ 1:

1. แยกบริการและ database จำลอง
2. Gateway route `/restaurants`, `/orders`, `/payments`
3. `POST /orders` ตอบ 202 แล้วประมวลผล async
4. Payment key ห้าม hardcode

---

## โจทย์

### ส่วนที่ 1 — บริการย่อย + คนละ store

| บริการ      | ข้อมูลที่เป็นเจ้าของ |
| ----------- | -------------------- |
| restaurants | รายการร้าน + เมนู    |
| orders      | ออเดอร์และสถานะ      |
| payments    | ธุรกรรมชำระเงิน      |

อย่างน้อย:

- `GET /restaurants` → list
- `POST /orders` → สร้างออเดอร์ `pending` แล้ว enqueue
- Worker ประมวลผล: สร้าง payment + update ออเดอร์เป็น `paid` หรือ `failed`
- `GET /orders/:id` → composition สถานะออเดอร์ (+ payment ถ้ามี)

### ส่วนที่ 2 — Gateway

- port `3400`
- Route ไป upstream (หรือ module ใน process เดียวกันก็ได้ แต่ต้องแยก boundary ชัด)
- ใส่ `X-Correlation-Id` และ access log ทุก request

### ส่วนที่ 3 — Secrets & Cold Start Note

- ดึง `api/payment-provider/key` จาก `lib/secrets.js` (หรือ wrapper)
- ใน `NOTES.md` อธิบายวิธีลด cold start สำหรับ `POST /orders` path

### ส่วนที่ 4 — สถานการณ์ล่ม (ออกแบบใน NOTES)

สมมติ payment upstream timeout 5 วินาที:

1. ทำไม monolith ถึงล่มทั้งระบบได้ง่าย?
2. ในสถาปัตยกรรมใหม่ อะไรยังควรตอบได้ตอน payment พัง?
3. จะใช้ sync หรือ async สำหรับ charge? ทำไม?

---

## เกณฑ์ผ่าน

- [ ] แยก store คนละบริการ
- [ ] Gateway route + correlation + access log
- [ ] สร้างออเดอร์แบบ async (202 + worker)
- [ ] ใช้ secret manager จำลอง
- [ ] `NOTES.md` ครบ

---

## เฉลย

ดู [`lab/solution/`](./lab/solution/)

```bash
node 02-intermediate/lab/solution/server.js

curl -s http://localhost:3400/restaurants | jq
curl -s -X POST http://localhost:3400/orders \
  -H 'content-type: application/json' \
  -d '{"restaurantId":"r1","items":["Pad Thai"],"amount":120}' | jq
```
