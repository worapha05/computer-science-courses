# Level 2 — Intermediate: Microservices Patterns & Distributed Communication

เป้าหมายระดับนี้: ออกแบบ **การคุยกันระหว่างบริการ** และ **ความเป็นเจ้าของข้อมูล** ให้ถูกต้อง
รวมถึงปัญหาจริงของ Serverless: **cold start**, ขนาดแพ็กเกจ และ **secrets**

---

## สารบัญ

1. [Microservices Communication — Sync vs Async](#1-microservices-communication--sync-vs-async)
2. [Service Discovery & API Gateways](#2-service-discovery--api-gateways)
3. [Distributed Data Management](#3-distributed-data-management)
4. [Cold Starts & Environments / Secrets](#4-cold-starts--environments--secrets)
5. [Best Practices สรุป](#5-best-practices-สรุป)

---

## 1. Microservices Communication — Sync vs Async

### Synchronous: REST และ gRPC

|                  | REST (HTTP/JSON)            | gRPC (HTTP/2 + Protobuf)                 |
| ---------------- | --------------------------- | ---------------------------------------- |
| Human-readable   | สูง                         | ต่ำ (binary)                             |
| Browser-friendly | สูง                         | ต้อง gateway/proxy                       |
| Contract         | OpenAPI                     | Protobuf + codegen                       |
| Streaming        | จำกัด                       | ดี (unary / streaming)                   |
| ใช้เมื่อ         | Public API, BFF, ทีมผสมภาษา | Internal service mesh, latency-sensitive |

```
Client ──HTTP──▶ Order Service ──gRPC──▶ Inventory
      │
      └──HTTP──▶ Payment
```

**ข้อดี sync:** ง่ายต่อการคิด request/response, error ชัดทันที
**ข้อเสีย:** latency รวม, cascading failure, temporal coupling (callee ต้องพร้อม)

### Asynchronous: Queues & Event Streaming

```
Order API ──publish──▶ Queue/Bus ──▶ Inventory Worker
        └──▶ Notification Worker
        └──▶ Analytics Consumer
```

| แบบ           | ตัวอย่าง                 | เหมาะกับ                                |
| ------------- | ------------------------ | --------------------------------------- |
| Command queue | SQS, RabbitMQ work queue | “ทำสิ่งนี้หนึ่งครั้ง”                   |
| Pub/Sub       | SNS+SQS, Pub/Sub         | หลาย subscriber คนละงาน                 |
| Event log     | Kafka, Kinesis           | replay, audit, multiple consumer groups |

**ข้อดี async:** ลด coupling, รับ spike, แยกทีมได้
**ข้อเสีย:** eventual consistency, debugging ยาก, ต้อง idempotency + DLQ

> **กฎทอง:** UI ที่ต้องรู้ผลทันที → sync (หรือ sync ขอบ + async ภายใน)
> งาน side-effect ที่ยอมดีเลย์ได้ → async

ดูตัวอย่าง: [`examples/01-sync-vs-async/`](./examples/01-sync-vs-async/)

---

## 2. Service Discovery & API Gateways

ใน cloud สมัยใหม่ “discovery” มักซ่อนใน:

- **DNS + load balancer** (Cloud Map, kube DNS)
- **API Gateway / Ingress / BFF**
- **Service Mesh** (Istio, Cloud Map + App Mesh) — ระดับ Expert จะแตะแนวคิด

### Reverse Proxy & Request Routing

```
     ┌─ /api/orders/* ──▶ orders-service
Client ──▶ Gateway ┼─ /api/pay/*  ──▶ payments-service
     └─ /api/catalog/* ──▶ catalog-service
```

Gateway ทำได้มากกว่า route:

| ความสามารถ               | ประโยชน์                        |
| ------------------------ | ------------------------------- |
| Path/Host/Header routing | แยก version (`v1`/`v2`), canary |
| Auth ที่ขอบ              | ลด logic ซ้ำในทุกบริการ         |
| Rate limit               | กัน noisy neighbor              |
| Request ID injection     | สาย observability               |
| Centralized access logs  | audit ทางเข้า                   |

### Centralized Logging ที่ Gateway

บันทึกอย่างน้อย: method, path, status, latency, caller, correlation id
**อย่า** log body ที่มี PII/secret โดยไม่ redact

ดูตัวอย่าง: [`examples/02-gateway-routing/`](./examples/02-gateway-routing/)

---

## 3. Distributed Data Management

### Database-per-service

แต่ละบริการเป็นเจ้าของ **schema / database** ของตัวเอง — คนอื่นห้าม query ตรง

```
Orders DB ◀── Order Service ──HTTP/Event──▶ Payment Service ──▶ Payments DB
```

| แบบ                      | ข้อดี                       | ข้อเสีย                                   |
| ------------------------ | --------------------------- | ----------------------------------------- |
| **Shared DB**            | join ง่าย, transaction ง่าย | coupling สูง, เปลี่ยน schema กระทบหลายทีม |
| **DB-per-service**       | ทีมอิสระ, เลือก tech ได้    | consistency ยาก, ไม่มี join ข้ามบริการ    |
| **Polyglot persistence** | เลือก DB ต่อ workload       | ops/cognitive load สูง                    |

### ความท้าทายของ Consistency

- ไม่มี 2-phase commit ง่าย ๆ ข้ามบริการ (และมักไม่ควรใช้)
- ใช้ **eventual consistency** + **compensating actions** (Saga — ระดับ Expert)
- อ่านรวมข้อมูล: **API Composition**, **CQRS/read model**, **UI BFF**

```
❌ SELECT * FROM orders o JOIN payments p ... (ข้าม service DB)
✅ Order Service emit OrderPaid → Payment Read Model update เอง
```

ดูตัวอย่าง: [`examples/03-database-per-service/`](./examples/03-database-per-service/)

---

## 4. Cold Starts & Environments / Secrets

### Cold Start เกิดจากอะไร?

1. จัดสรร compute + โหลด runtime (Node/Python/Java…)
2. โหลด deployment package / image layers
3. รัน init ระดับ process (import SDK ใหญ่, เปิด connection)
4. ถึงค่อยเข้า handler

| ลด cold start                           | รายละเอียด                                      |
| --------------------------------------- | ----------------------------------------------- |
| ลดขนาดแพ็กเกจ                           | tree-shake, ไม่ยัดทั้ง `node_modules` ที่ไม่ใช้ |
| Runtime เบา                             | Node/Python มักเร็วกว่า JVM เย็น                |
| Provisioned concurrency / min instances | จ่ายเงินแลก latency                             |
| Init นอก handler อย่างชาญฉลาด           | reuse client แต่ไม่บล็อก init นานเกินจำเป็น     |
| Arm/SnapStart (ตาม platform)            | ใช้ feature vendor                              |

### Environment Variables vs Secret Manager

|          | Env vars                        | Secret Manager              |
| -------- | ------------------------------- | --------------------------- |
| เหมาะกับ | feature flag, non-secret config | password, API key, cert     |
| Rotation | ต้อง redeploy/ใหม่ revision     | rotate ได้โดย update secret |
| Audit    | จำกัด                           | ดีกว่า                      |
| Risk     | หลุดใน CI log / screenshot ง่าย | ยังต้องระวัง IAM            |

**แนวทาง:** อ่าน secret ตอน init (warm) + cache สั้น ๆ + สิทธิ์ IAM แคบที่สุด

ดูตัวอย่าง: [`examples/04-cold-start-secrets/`](./examples/04-cold-start-secrets/)

---

## 5. Best Practices สรุป

1. **Sync ที่ขอบ, Async ภายใน** เมื่อทำได้
2. **Timeout + retry เฉพาะที่ idempotent** ทุก sync call
3. **Gateway เป็นนโยบายกลาง** (auth, rate limit, correlation) ไม่ใช่ business logic ก้อนโต
4. **ห้าม share database** ข้ามทีมบริการ — share ผ่าน API/event
5. **วัด cold start แยกจาก warm p50/p99**
6. **Secret ไม่อยู่ใน git** และไม่ echo ใน log

---

## ตัวอย่างในระดับนี้

| folder                                                                     | สิ่งที่เรียนรู้                 |
| -------------------------------------------------------------------------- | ------------------------------- |
| [`examples/01-sync-vs-async/`](./examples/01-sync-vs-async/)               | REST chain vs queue pipeline    |
| [`examples/02-gateway-routing/`](./examples/02-gateway-routing/)           | Reverse proxy + access log      |
| [`examples/03-database-per-service/`](./examples/03-database-per-service/) | แยก store + composition         |
| [`examples/04-cold-start-secrets/`](./examples/04-cold-start-secrets/)     | จำลอง cold start + secret cache |

เมื่อพร้อมแล้ว ไปทำ Lab: [`LAB.md`](./LAB.md)
