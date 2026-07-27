# Level 1 — Beginner: Architecture Foundations & Serverless Core

เป้าหมายระดับนี้: ให้คุณเข้าใจ **ทำไมสถาปัตยกรรมถึงสำคัญ** และเริ่มเขียน Serverless Function + เชื่อม API Gateway ได้จริง
ไม่ใช่แค่ deploy “Hello World” — เพื่อเลือก Monolith / Microservices / Serverless ให้เหมาะกับบริบท

---

## สารบัญ

1. [Monolith vs Microservices vs Serverless](#1-monolith-vs-microservices-vs-serverless)
2. [Serverless Essentials — FaaS, Stateless, Event-driven](#2-serverless-essentials--faas-stateless-event-driven)
3. [Writing Your First Function](#3-writing-your-first-function)
4. [API Gateway Integration](#4-api-gateway-integration)
5. [Best Practices สรุป](#5-best-practices-สรุป)

---

## 1. Monolith vs Microservices vs Serverless

ทั้งสามไม่ใช่ศัตรูกัน — เป็น **จุดบนสเปกตรัม** ของการแยก deployable unit และการจัดการ infrastructure

| มิติ       | Monolith                  | Microservices                  | Serverless (FaaS)                     |
| ---------- | ------------------------- | ------------------------------ | ------------------------------------- |
| Unit หลัก  | แอปเดียว / process เดียว  | บริการเล็กหลายตัว              | Function ต่อ use case / event         |
| Deploy     | ทั้งก้อน                  | อิสระต่อบริการ                 | อิสระต่อ function (หรือ group)        |
| Scale      | ทั้งแอป                   | ต่อบริการ                      | ต่อ concurrency ของ function          |
| Ops        | ดูแล runtime เอง          | สูง (service mesh, discovery…) | ต่ำกว่า (platform ดูแล) แต่มีขีดจำกัด |
| Coupling   | ในโค้ด/module             | ผ่าน network + contract        | ผ่าน events / HTTP + managed services |
| เหมาะเมื่อ | ทีมเล็ก domain ยังไม่นิ่ง | หลายทีม scale คนละมิติ         | Bursty traffic, event pipelines       |

```
Monolith     Microservices     Serverless
─────────     ─────────────     ──────────
┌─────────────────┐   ┌────┐ ┌────┐ ┌────┐   f() f() f()
│ UI + API + Jobs │   │Ord │ │Pay │ │Ship│   │ │ │
│ + DB access  │   └──┬─┘ └──┬─┘ └──┬─┘   └─┬─┴─┬─┘
└────────┬────────┘   │  │  │    │ │
   │     API GW / Mesh / Bus   API GW / Triggers
   ▼      ▼  ▼  ▼    ▼ ▼
  [DB]     [DB] [DB] [DB]   Queues / DB / Storage
```

### Trade-offs ที่สำคัญ

**Monolith**

- ✅ Debug ง่าย, transaction ใน process เดียว, latency ในเครื่องต่ำ
- ❌ Scale ทั้งก้อน, deploy เสี่ยงใหญ่, ทีมใหญ่ชนกันใน repo
- แนวทางสมัยใหม่: **Modular Monolith** — แยก module ชัดก่อนแยกบริการ

**Microservices**

- ✅ Deploy อิสระ, ทีมเป็นเจ้าของ domain, scale เฉพาะจุดที่ร้อน
- ❌ Network failure, distributed data, versioning, ops ซับซ้อน
- ต้นทุนซ่อน: **distributed monolith** ถ้ายังแยกผิด boundary แล้วเรียก sync กันแน่น

**Serverless**

- ✅ Pay-per-use, scale-to-zero, โฟกัส business logic
- ❌ Cold start, timeout/payload limits, vendor lock-in, local debug ยากกว่า
- ไม่ใช่ “ไม่มี server” — คุณแค่ไม่ดูแล server เอง

> **กฎทอง:** เริ่มจาก complexity ที่ทีมรับไหว แล้วแยกเมื่อมีแรงกดดันจริง (ทีม, scale, release cadence)
> ดูโค้ดเปรียบเทียบ: [`examples/01-architecture-patterns/`](./examples/01-architecture-patterns/)

---

## 2. Serverless Essentials — FaaS, Stateless, Event-driven

### Execution Model (FaaS)

```
Trigger (HTTP / SQS / PubSub / Schedule / Storage)
  │
  ▼
┌─────────────────── Platform ───────────────────┐
│ 1. รับ event         │
│ 2. หา / สร้าง execution environment (cold/warm) │
│ 3. เรียก handler(event, context)    │
│ 4. คืนผล / ส่งต่อไป destination     │
│ 5. เก็บ environment ไว้สักพัก (reuse = warm) │
└────────────────────────────────────────────────┘
```

| แนวคิด          | ความหมาย                                                              |
| --------------- | --------------------------------------------------------------------- |
| **Cold start**  | ครั้งแรกหรือหลัง idle นาน — ต้องโหลด runtime + code → latency สูงขึ้น |
| **Warm start**  | ใช้ environment เดิม → เร็วกว่า                                       |
| **Concurrency** | จำนวน invocation ที่รันพร้อมกัน (มี account/function limit)           |
| **Timeout**     | Lambda ~15 นาที, Cloud Functions ตามรุ่น — อย่าทำงานยาวเกินโดยไม่คิด  |
| **Memory**      | กำหนด CPU โดยอ้อม (โดยเฉพาะ Lambda)                                   |

### Stateless Design

Function **ไม่ควรพึ่งพา memory ของ process ข้าม request** เป็นความถูกต้องของธุรกิจ

```
❌ ผิดแนวคิด       ✅ ถูกแนวคิด
let balance = 0;      // อ่าน/เขียนจาก DB / Cache
export handler() {     export async function handler(e) {
 balance += e.amount;     await db.updateBalance(...);
}          }
```

สิ่งที่ _อนุญาต_ ใน process memory (optimization):

- connection pool / SDK client ที่ reuse ได้
- cache ที่ยอม stale ได้ (พร้อม TTL + invalidation)
- secret ที่ดึงครั้งเดียวต่อ warm instance

สิ่งที่ _ห้าม_ เป็น source of truth:

- ตัวนับออเดอร์, session สำคัญ, lock ในตัวแปร global

ดูตัวอย่าง: [`examples/02-faas-stateless/`](./examples/02-faas-stateless/)

### Event-driven Triggers

| Trigger                                  | ใช้เมื่อ                    |
| ---------------------------------------- | --------------------------- |
| HTTP (API Gateway / Cloud Run)           | Request-response จาก client |
| Queue (SQS / Pub/Sub)                    | งาน async, buffer spike     |
| Object storage                           | upload ไฟล์แล้วประมวลผล     |
| Schedule (EventBridge / Cloud Scheduler) | Cron / batch เบา ๆ          |
| Stream (Kinesis / Dataflow)              | ประมวลผลต่อเนื่อง           |

> Serverless เก่งเมื่อ **งานถูกตัดเป็น event เล็ก ๆ ที่ idempotent**
> งานยาวที่ต้อง state machine → Step Functions / Workflows หรือ container ยาวขึ้น

---

## 3. Writing Your First Function

รูปแบบ handler ที่พบบ่อย (AWS Lambda Node.js):

```js
export async function handler(event, context) {
  // 1. parse input
  // 2. validate
  // 3. business logic (เรียก DB / API อื่น)
  // 4. return response ตาม contract ของ trigger
}
```

สำหรับ **HTTP via API Gateway (proxy integration)**:

```js
return {
  statusCode: 200,
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ ok: true }),
};
```

สำหรับ **GCP Cloud Functions (HTTP)**:

```js
export function hello(req, res) {
  res.status(200).json({ ok: true });
}
```

### Testing ก่อน Deploy

1. **Unit test** handler ด้วย event fixture
2. **Local invoke** (SAM / Functions Framework / script เอง)
3. **Integration** กับ emulator หรือ staging
4. Deploy แล้ว smoke test ด้วย curl / Postman

ดูตัวอย่าง: [`examples/03-first-function/`](./examples/03-first-function/)

### Deploy แนวคิด (ยังไม่บังคับรันใน lab นี้)

```bash
# AWS SAM (แนวคิด)
sam build && sam deploy --guided

# GCP (แนวคิด)
gcloud functions deploy hello --runtime=nodejs20 --trigger-http --allow-unauthenticated
```

ใน bootcamp นี้เราใช้ **local adapter** ให้คุณโฟกัส handler contract ก่อนผูก cloud จริง

---

## 4. API Gateway Integration

API Gateway คือ **ทางเข้า HTTP** ที่ map route → backend (Lambda / Cloud Function / Cloud Run)

```
Client
 │ HTTPS
 ▼
API Gateway ── auth / throttle / CORS / transform ──▶ Function
 │              │
 └── access logs / metrics ◀────────────────────────────┘
```

### สิ่งที่ Gateway จัดการให้บ่อย ๆ

| ความสามารถ                  | ทำไมสำคัญ                           |
| --------------------------- | ----------------------------------- |
| Routing                     | แยก path/method ไปคนละ function     |
| AuthN (JWT / API Key / IAM) | ไม่ใส่ logic auth ซ้ำในทุก function |
| Throttling / Quota          | กัน abuse และ cascade               |
| CORS                        | Browser เรียก cross-origin ได้      |
| Request/Response mapping    | แปลง header/body ก่อนถึง function   |
| TLS termination             | Certificate ที่ขอบระบบ              |

### CORS ที่ต้องรู้

Browser จะส่ง **preflight OPTIONS** เมื่อเป็น cross-origin + header พิเศษ

Function / Gateway ต้องตอบ:

- `Access-Control-Allow-Origin`
- `Access-Control-Allow-Methods`
- `Access-Control-Allow-Headers`

อย่าตอบ `*` ร่วมกับ credential ถ้าไม่เข้าใจความเสี่ยง

### Query strings & Headers

```
GET /orders?status=paid&limit=20
Header: X-Correlation-Id: abc-123
Header: Authorization: Bearer ...
```

ใน Lambda (HTTP API v2) มักอยู่ใน:

- `event.queryStringParameters`
- `event.headers`
- `event.requestContext`

**Best practice:** ส่งต่อ `X-Correlation-Id` เข้าทุก log และ downstream call

ดูตัวอย่าง: [`examples/04-api-gateway/`](./examples/04-api-gateway/)

---

## 5. Best Practices สรุป

1. **เลือกสถาปัตยกรรมตามแรงกดดันจริง** ไม่ตามกระแส
2. **Function เล็ก ชัด หนึ่งความรับผิดชอบ** — อย่าทำ “God Lambda”
3. **Idempotent ตาม event id** — trigger อาจส่งซ้ำ
4. **Validate input ที่ขอบ** (Gateway + handler)
5. **อย่าเก็บ secret ในโค้ด** — ใช้ env / Secret Manager (ละเอียดในระดับ 2)
6. **ออกแบบ response contract** (`statusCode`, error shape) ให้ client คาดเดาได้
7. **วัด cold start และ p99** ตั้งแต่ staging ไม่รอ production โวย

---

## ตัวอย่างในระดับนี้

| folder                                                                       | สิ่งที่เรียนรู้                  |
| ---------------------------------------------------------------------------- | -------------------------------- |
| [`examples/01-architecture-patterns/`](./examples/01-architecture-patterns/) | จำลอง Monolith / MS / Serverless |
| [`examples/02-faas-stateless/`](./examples/02-faas-stateless/)               | Stateless vs anti-pattern        |
| [`examples/03-first-function/`](./examples/03-first-function/)               | Handler + local invoke + Python  |
| [`examples/04-api-gateway/`](./examples/04-api-gateway/)                     | Express เป็น local API Gateway   |

เมื่อพร้อมแล้ว ไปทำ Lab: [`LAB.md`](./LAB.md)
