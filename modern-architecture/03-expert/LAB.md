# Lab ระดับ Expert — “NovaMart” Outage War-Room

## เป้าหมาย

ออกแบบและลงมือแก้ระบบอีคอมเมิร์ซ **NovaMart** ที่กำลังล่มจาก cascading failure:

- Implement **Orchestrated Saga** สำหรับ checkout
- ใส่ **timeout / retry / circuit breaker / graceful degradation**
- เพิ่ม **distributed tracing + correlation logs**
- วางแผน **IaC + canary + multi-region** ใน runbook

ทำด้วยตัวเองก่อน แล้วค่อยเทียบกับ [`lab/solution/`](./lab/solution/)

---

## กรณีศึกษา (สถานการณ์จริงจำลอง)

เวลา 20:15 — flash sale

อาการ:

1. Payment provider latency พุ่งจาก 50ms → 3s
2. Order service retry ไม่มี backoff → thundering herd
3. Inventory connection pool เต็ม
4. หน้า homepage ที่เรียก recommendation (พึ่ง payment graph โดยไม่ตั้งใจ) ล่มตาม
5. ไม่มี trace ทำให้ war-room หา root cause ช้า 40 นาที

CEO ถาม: “ทำไมเมนูโฮมเพจพังด้วย?”

---

## โจทย์

### ส่วนที่ 1 — Checkout Saga (Orchestration)

Implement flow:

1. `reserveInventory`
2. `chargePayment`
3. `arrangeShipping`

ถ้าขั้นใดล้ม → compensate ย้อนกลับให้ครบ
จำลองเคส:

| orderId       | ผลที่คาดหวัง                       |
| ------------- | ---------------------------------- |
| `NM-OK`       | สำเร็จ                             |
| `NM-PAYFAIL`  | ล้มที่ payment → release inventory |
| `NM-SHIPFAIL` | ล้มที่ shipping → refund + release |

### ส่วนที่ 2 — Resilience ที่ Payment Adapter

ห่อ payment call ด้วย:

- timeout 100ms (ใน lab ใช้ตัวเลขจำลอง)
- retry สูงสุด 2 ครั้ง เฉพาะ `UNAVAILABLE`/`TIMEOUT` + exponential backoff + jitter
- circuit breaker เปิดเมื่อล้มติดกัน
- recommendation / homepage ใช้ **fallback cache** เมื่อ dependency พัง

### ส่วนที่ 3 — Observability

ทุก checkout ต้องมี:

- `x-correlation-id`
- spans อย่างน้อย: `checkout`, `inventory`, `payment`, `shipping`
- structured log ที่มี `traceId` + `correlationId`

### ส่วนที่ 4 — Runbook (NOTES + RUNBOOK)

เขียนแผน:

1. ทำไม homepage ถึงพังตาม (architectural smell)
2. Canary rollout ของ function checkout แบบ 10% → 50% → 100%
3. Active-passive multi-region ขั้นต่ำที่รับได้

---

## เกณฑ์ผ่าน

- [ ] Saga + compensation ทำงานครบ 3 เคส
- [ ] มี timeout/retry/circuit/fallback
- [ ] มี trace/correlation ในผลลัพธ์หรือ log
- [ ] RUNBOOK/NOTES ครบ

---

## เฉลย

```bash
node 03-expert/lab/solution/novamart.js
```

ดู [`lab/solution/`](./lab/solution/)
