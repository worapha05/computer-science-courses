# Lab ระดับ Beginner — ระบบ “ShopLite” API แบบ Serverless

## เป้าหมาย

สร้าง API จำลองร้านค้าเล็ก **ShopLite**:

- แยกความรับผิดชอบแบบ serverless (handler ต่อ resource)
- รับ HTTP ผ่าน **local API Gateway** (Express)
- รองรับ **CORS**, query string, headers และ **correlation id**
- ออกแบบ state แบบ **stateless** (เก็บใน memory store ภายนอก process logic)

ทำด้วยตัวเองก่อน แล้วค่อยเทียบกับ [`lab/solution/`](./lab/solution/)

---

## กรณีศึกษา

startup **ShopLite** มี monolith Express ก้อนเดียว
ตอน flash sale CPU พุ่งทั้งก้อน และทีมอยากแยก `/products` กับ `/orders` ให้ scale คนละแบบ

CTO ต้องการ POC บน serverless style:

1. `GET /products` และ `POST /orders` เป็นคนละ handler
2. Gateway จัดการ CORS + ส่งต่อ `X-Correlation-Id`
3. ไม่ใช้ตัวแปร global เป็น source of truth ของออเดอร์

---

## โจทย์

### ส่วนที่ 1 — Product Catalog Handler

เขียน `productsHandler` ที่:

| Method | Path                       | พฤติกรรม                                      |
| ------ | -------------------------- | --------------------------------------------- |
| `GET`  | `/products`                | คืนรายการสินค้า (hardcode อย่างน้อย 3 รายการ) |
| `GET`  | `/products?category=books` | กรองตาม category                              |

Response ตัวอย่าง:

```json
{
  "items": [{ "id": "p1", "name": "Clean Architecture", "category": "books", "price": 890 }],
  "correlationId": "..."
}
```

### ส่วนที่ 2 — Orders Handler (Stateless)

เขียน `ordersHandler` ที่:

1. `POST /orders` รับ body `{ "productId": "p1", "qty": 2 }`
2. Validate: `productId` ต้องมีใน catalog, `qty` เป็นจำนวนเต็ม 1–10
3. สร้าง order id แล้ว **บันทึกลง store ภายนอก** (เช่น `Map` ผ่าน module แยก — ไม่ใช้ `let orders = []` ใน handler file แบบ global ที่ handler เป็นเจ้าของโดยตรงก็ได้ แต่ต้องแยกชัดว่าเป็น external store)
4. คืน `201` พร้อม order
5. `GET /orders/:id` คืนออเดอร์ หรือ `404`

ถ้า body ไม่ valid → `400` พร้อม `{ "error": "..." }`

### ส่วนที่ 3 — Local API Gateway

สร้าง server ที่:

1. Listen port `3200` (หรือ `PORT`)
2. Map routes ไป handlers ด้านบน
3. ตอบ **OPTIONS** สำหรับ CORS
4. ถ้าไม่มี `X-Correlation-Id` ให้สร้างใหม่แล้วใส่ใน response header และ body ที่เกี่ยวข้อง

### ส่วนที่ 4 — Migration Note

ใน `NOTES.md` อธิบายสั้น ๆ (ภาษาไทย):

1. ทำไมการย้ายเฉพาะ `/orders` ไป serverless ก่อนถึงช่วยตอน flash sale?
2. ข้อเสียของ sync call จาก `orders` ไป `products` ใน production คืออะไร?
3. ถ้า browser เรียกจาก `http://localhost:5173` ต้องตั้ง CORS อย่างไร?

---

## เกณฑ์ผ่าน

- [ ] `GET /products` และ filter `category` ทำงาน
- [ ] `POST /orders` validate + บันทึก stateless store
- [ ] `GET /orders/:id` คืน 200/404 ได้
- [ ] CORS preflight ผ่าน
- [ ] มี correlation id ใน log หรือ response
- [ ] `NOTES.md` ตอบครบ

---

## เฉลย

ดูโค้ดเต็มที่ [`lab/solution/`](./lab/solution/)

```bash
cd modern-architecture-bootcamp
npm install
node 01-beginner/lab/solution/server.js

curl -s "http://localhost:3200/products?category=books" | jq
curl -s -X POST http://localhost:3200/orders \
  -H 'content-type: application/json' \
  -H 'x-correlation-id: lab-beginner' \
  -d '{"productId":"p1","qty":2}' | jq
```
