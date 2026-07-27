# เฉลยคำถามคิด — ShopLite Beginner

## 1. ทำไมย้ายเฉพาะ `/orders` ไป serverless ก่อนถึงช่วยตอน flash sale?

เพราะ flash sale มักกระแทกเส้นทาง **สร้างออเดอร์** เป็นหลัก การ scale function ของ `/orders` (หรือ concurrency ของมัน) ไม่บังคับให้ scale โค้ด catalog / admin ทั้งก้อนพร้อมกัน ลดต้นทุนและลด blast radius — ตราบใดที่ dependency (DB, payment) รับโหลดได้

## 2. ข้อเสียของ sync call จาก orders → products ใน production?

- เพิ่ม **latency** และ **coupling** — orders พังเมื่อ products ช้า/ล่ม (cascading failure)
- ตอน traffic สูงจะขยาย concurrency ของคู่บริการพร้อมกัน
- ทางเลือกที่ดีกว่า: embed ราคา/ชื่อที่จำเป็นตอนเพิ่มลงตะกร้า, ใช้ cache, หรือ event `ProductUpdated`

## 3. CORS จาก `http://localhost:5173`

ตั้ง `Access-Control-Allow-Origin: http://localhost:5173` (เจาะจง origin ดีกว่า `*` ถ้าใช้ credentials)
ตอบ preflight `OPTIONS` พร้อม `Allow-Methods` / `Allow-Headers` ที่ client ส่งจริง (เช่น `Content-Type`, `X-Correlation-Id`)
