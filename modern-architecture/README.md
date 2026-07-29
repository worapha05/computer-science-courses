📍 **Nav:** [`🏠 Dev Learning Courses Hub`](https://github.com/worapha05/dev-learning-courses-hub/blob/main/README.md) | [`📂 Computer Science Courses Index`](../README.md) | 📝 [`Prompt File`](https://github.com/worapha05/ai-learning-prompts-hub/blob/main/course-generation/computer-science-courses/modern-architecture-prompt.md)

---

# Modern Architecture Bootcamp — Zero to Expert

bootcamp เรียนรู้ **Modern Software Architecture** แบบครบวงจร
เน้น **Microservices + Serverless** (AWS Lambda / GCP Cloud Functions & Cloud Run)
จาก Architecture Foundations → Distributed Patterns → Enterprise Resilience / Mesh / Ops

---

## เป้าหมายของหลักสูตร

เมื่อจบหลักสูตรนี้ คุณจะสามารถ:

- เปรียบเทียบ **Monolith vs Microservices vs Serverless** และเลือกแนวทางตาม trade-off จริง
- ออกแบบและเขียน **FaaS** แบบ stateless พร้อม **API Gateway** (CORS, headers, query)
- ออกแบบการสื่อสารระหว่างบริการแบบ **Sync (REST/gRPC)** และ **Async (Queue/Event)**
- จัดการข้อมูลแบบ **Database-per-service**, เข้าใจ consistency และ cold start / secrets
- ใช้ **Saga**, Circuit Breaker, Retry/Backoff, Observability และ **IaC** สำหรับ production serverless

---

## โครงสร้างหลักสูตร

| Level            | folder                                   | หัวข้อหลัก                                               | เวลาแนะนำ   |
| ---------------- | ---------------------------------------- | -------------------------------------------------------- | ----------- |
| 1 — Beginner     | [`01-beginner/`](./01-beginner/)         | Architecture patterns, FaaS, first function, API Gateway | 1–2 สัปดาห์ |
| 2 — Intermediate | [`02-intermediate/`](./02-intermediate/) | Sync/Async, Gateway routing, data ownership, cold starts | 2–3 สัปดาห์ |
| 3 — Expert       | [`03-expert/`](./03-expert/)             | Saga, resilience, observability, IaC & deployments       | 2–4 สัปดาห์ |

แต่ละระดับประกอบด้วย:

1. **`README.md`** — ทฤษฎีเชิงลึกภาษาไทย เน้น design trade-offs และ best practices
2. **`examples/`** — โค้ด Node.js / Python ที่รันได้ local (จำลอง Lambda + API Gateway)
3. **`LAB.md`** — โจทย์กรณีศึกษาจริงพร้อมเฉลยเต็มใน `lab/solution/`

---

## ข้อกำหนดเบื้องต้น

- ความรู้พื้นฐาน JavaScript (ES modules, async/await) หรือ Python 3.11+
- ความเข้าใจ HTTP / JSON และแนวคิด REST
- ติดตั้ง [Docker](https://www.docker.com/) และ [Node.js 20+](https://nodejs.org/)

```bash
docker --version
docker compose version
node -v # ควรเป็น v20.x ขึ้นไป
```

> **หมายเหตุ:** ตัวอย่างส่วนใหญ่รัน **local** โดยไม่ต้องมี AWS/GCP account
> ไฟล์ IaC ในระดับ Expert พร้อม deploy จริงเมื่อคุณตั้ง credential แล้ว

---

## วิธีใช้ Bootcamp

1. เลือกระดับที่ต้องการ แล้ว `cd` เข้าไป
2. `npm install` เพื่อติดตั้ง dependencies
3. อ่าน `README.md` ของระดับนั้นให้จบ — โฟกัสที่ **ทำไมออกแบบแบบนี้**
4. รันตัวอย่างใน `examples/` ตามลำดับ (หรือใช้ `npm run <script>` ตามที่ระบุในแต่ละระดับ)
5. ทำ Lab ใน `LAB.md` **ด้วยตัวเองก่อน** แล้วค่อยดูเฉลย
6. ไประดับถัดไปเมื่ออธิบาย trade-off ของการออกแบบได้

```bash
cd 01-beginner
npm install
node examples/04-api-gateway/server.js
# แล้วเปิดอีกเทอร์มินัล: curl "http://localhost:3100/hello?name=Ada"
```

| บริการ (optional)              | Host Port     | Notes                                 |
| ------------------------------ | ------------- | ------------------------------------- |
| Redis (cache / rate-limit lab) | `6379`        | จาก `docker compose up -d`            |
| Local gateway demo             | `3100`–`3300` | รันจาก examples ตาม README แต่ละระดับ |

---

## Learning Path ที่แนะนำ

```
Beginner: Monolith vs MS vs Serverless + FaaS + API Gateway
 ↓
Intermediate: Sync/Async + Gateway/Routing + Data-per-service + Cold Start
 ↓
Expert: Saga + Resilience + Observability + IaC / Multi-region / Canary
 ↓
project จริงของคุณเอง (Order Platform / Notification Hub / BFF + Event-Driven)
```

---

## เมื่อไหร่ใช้ Monolith / Microservices / Serverless?

| คำถาม                                              | แนวทาง                                                         |
| -------------------------------------------------- | -------------------------------------------------------------- |
| ทีมเล็ก, domain ยังไม่ชัด, ต้องการ ship เร็ว?      | Modular Monolith ก่อน                                          |
| หลายทีม, deploy อิสระ, scale คนละมิติ?             | Microservices                                                  |
| งาน bursty, event-driven, ops อยากน้อย?            | Serverless (Lambda / Cloud Functions)                          |
| ต้องการ container + scale-to-zero + HTTP ยาวหน่อย? | Cloud Run / App Runner                                         |
| Latency ต่ำมาก + connection pool หนัก?             | ระวัง cold start — พิจารณา provisioned concurrency / container |

> **กฎทอง:** อย่าแยก microservices เพราะ “เท่” — แยกเมื่อมี **boundary ของทีม/domain/scale** ที่ชัดจริง ๆ

---

## Best Practices ข้ามระดับ (สรุปเร็ว)

1. **ออกแบบรอบ business capability** ไม่ใช่รอบตารางฐานข้อมูล
2. **Stateless ที่ compute** — state อยู่ใน datastore / queue / cache ที่ชัดเจน
3. **กำหนด consistency model** (strong / eventual) ต่อ use case อย่าสมมติว่าทุกอย่าง atomic ข้ามบริการ
4. **Failure เป็น default path** — retry, timeout, circuit breaker, DLQ, graceful degradation
5. **Observability ตั้งแต่วันแรก** — correlation id, structured logs, traces, SLIs
