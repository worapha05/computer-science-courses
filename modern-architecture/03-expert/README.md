# Level 3 — Expert: Enterprise Distributed Patterns, Resilience & Mesh

เป้าหมายระดับนี้: ออกแบบระบบที่ **อยู่รอดเมื่อส่วนหนึ่งพัง** และ **สังเกตการณ์ได้เมื่อพัง**
ครอบคลุม Saga, resilience patterns, OpenTelemetry-style tracing และ IaC / deployment strategies

---

## สารบัญ

1. [Distributed Transactions — Saga & ทางเลือกของ 2PC](#1-distributed-transactions--saga--ทางเลือกของ-2pc)
2. [Advanced Resilience](#2-advanced-resilience)
3. [Observability at Scale](#3-observability-at-scale)
4. [Enterprise Serverless Operations](#4-enterprise-serverless-operations)
5. [Best Practices สรุป](#5-best-practices-สรุป)

---

## 1. Distributed Transactions — Saga & ทางเลือกของ 2PC

### ทำไม 2PC ถึงไม่นิยมข้าม microservices?

Two-Phase Commit ล็อก resource จนกว่าทุก participant พร้อม commit

| ปัญหา            | ผล                                                     |
| ---------------- | ------------------------------------------------------ |
| Blocking         | Coordinator/participant พังระหว่าง prepare → lock ค้าง |
| Latency          | ทุกฝ่ายต้องพร้อมพร้อมกัน                               |
| Coupling         | ผูก availability ของหลายบริการ                         |
| Cloud managed DB | มักไม่เปิด XA ข้ามบริการให้ใช้ง่าย                     |

ในระบบสมัยใหม่เลือก **eventual consistency + business compensations** แทน

### Saga Pattern

Saga = ลำดับ local transactions + **compensating actions** เมื่อขั้นหลังล้ม

```
Reserve Inventory → Charge Payment → Arrange Shipment
  │     │     │
 Compensate:  Compensate:  Compensate:
 Release stock  Refund   Cancel shipment
```

#### Choreography

แต่ละบริการฟัง event แล้วทำขั้นถัดไปเอง

```
OrderCreated → InventoryReserved → PaymentCaptured → OrderShipped
      ↘ InventoryOutOfStock → OrderCancelled
```

- ✅ ไม่มีจุดศูนย์กลาง
- ❌ ไหลของ event ซับซ้อน, ยากต่อมองภาพรวมเมื่อบริการเยอะ

#### Orchestration

ตัว orchestrator (Order Saga / Step Functions / Workflows) สั่งแต่ละขั้น

```
Orchestrator
 ├─ call Inventory.reserve
 ├─ call Payment.charge
 ├─ call Shipping.arrange
 └─ on failure → compensate in reverse
```

- ✅ มอง flow ชัด, เหมาะกับ business ที่ซับซ้อน
- ❌ orchestrator เป็นจุดสำคัญ (ต้อง HA + idempotent)

ดูตัวอย่าง: [`examples/01-saga-pattern/`](./examples/01-saga-pattern/)

---

## 2. Advanced Resilience

เป้าหมาย: กัน **cascading failure** — จุดเดียวช้าทำให้ทั้งกราฟบริการล่ม

| Pattern                                  | ทำอะไร                                                     |
| ---------------------------------------- | ---------------------------------------------------------- |
| **Timeout**                              | จำกัดเวลารอ — พื้นฐานที่ต้องมีก่อน retry                   |
| **Retry + Exponential Backoff + Jitter** | ทนชั่วคราว; jitter กัน thundering herd                     |
| **Circuit Breaker**                      | เปิดวงจรเมื่อ error rate สูง → fail fast ชั่วคราว          |
| **Bulkhead**                             | แยก pool/thread/concurrency ต่อ dependency                 |
| **Rate Limiting**                        | จำกัด QPS ที่ขอบหรือต่อ downstream                         |
| **Graceful Degradation**                 | เสิร์ฟค่าประมาณ/ cache / ปิด feature ย่อยแทนการพังทั้งหน้า |

```
Closed ──failures──▶ Open ──cooldown──▶ Half-Open ──success──▶ Closed
      │     │
      └◀──── failures ─────┘
```

**กฎ retry:** retry เฉพาะ **idempotent** หรือมี idempotency key
อย่า retry `POST` สร้างออเดอร์มั่ว ๆ โดยไม่มี key

ดูตัวอย่าง: [`examples/02-resilience/`](./examples/02-resilience/)

---

## 3. Observability at Scale

เสาหลักสามอย่าง: **Logs, Metrics, Traces**

| สัญญาณ  | คำถามที่ตอบ                                        |
| ------- | -------------------------------------------------- |
| Metrics | ระบบสุขภาพดีไหม? (latency, error rate, saturation) |
| Logs    | เกิดอะไรขึ้นกับ request นี้?                       |
| Traces  | request เดินทางผ่านบริการไหน ช้าตรงไหน?            |

### Distributed Tracing

- **OpenTelemetry** — standard ข้าม vendor
- **AWS X-Ray** / **GCP Cloud Trace** — managed บนคลาวด์นั้น

ส่งต่อ context ผ่าน headers เช่น `traceparent` (W3C) หรือ `X-Amzn-Trace-Id`

```
API GW ──span──▶ Order Fn ──span──▶ Payment Fn
      │
      └──span──▶ Inventory Fn
```

### Centralized Logs & Metrics

- Structured JSON logs + correlation / trace id
- SLIs: availability, latency (p50/p95/p99), error budget
- Alert จาก **อาการผู้ใช้** ไม่ใช่แค่ CPU

ดูตัวอย่าง: [`examples/03-observability/`](./examples/03-observability/)

---

## 4. Enterprise Serverless Operations

### Infrastructure as Code

| เครื่องมือ               | จุดเด่น                       |
| ------------------------ | ----------------------------- |
| **Serverless Framework** | เร็วสำหรับ functions + events |
| **AWS SAM / CDK**        | ลึกกับ AWS                    |
| **Terraform / OpenTofu** | multi-cloud, state ชัด        |
| **Pulumi**               | IaC ด้วยภาษาโปรแกรม           |

หลักการ: **ทุกอย่างใน git** — function, IAM, routes, alarms, dashboards

### Multi-region

- Active-active: ซับซ้อนเรื่อง data replication + conflict
- Active-passive: failover ง่ายกว่า เริ่มได้ก่อน
- ใช้ global entry (Route 53 / Global HTTPS LB) + data strategy ที่คิดมาแล้ว

### Canary / Blue-Green สำหรับ Functions

```
Blue (v1) 100% → Canary 10% v2 / 90% v1 → 100% v2
      ▲
      └── rollback อัตโนมัติถ้า error rate พุ่ง
```

- AWS: Lambda aliases + CodeDeploy / weighted alias
- GCP: Cloud Run revisions + traffic splitting

ดูตัวอย่าง: [`examples/04-iac-deployments/`](./examples/04-iac-deployments/)

---

## 5. Best Practices สรุป

1. **อย่าใช้ 2PC ข้ามบริการ** — ใช้ Saga + idempotency
2. **Timeout ทุก dependency** แล้วค่อยคิด retry/circuit
3. **Fail fast + degrade** ดีกว่า hang ทั้งระบบ
4. **Trace + metric + log** ใช้ id เดียวกัน
5. **Deploy ด้วย IaC + progressive delivery** ไม่มี “แก้ใน console แล้วลืม”
6. **Game day / chaos** สำหรับ path สำคัญก่อน Black Friday

---

## ตัวอย่างในระดับนี้

| folder                                                           | สิ่งที่เรียนรู้                    |
| ---------------------------------------------------------------- | ---------------------------------- |
| [`examples/01-saga-pattern/`](./examples/01-saga-pattern/)       | Orchestration + Choreography       |
| [`examples/02-resilience/`](./examples/02-resilience/)           | Retry, circuit breaker, rate limit |
| [`examples/03-observability/`](./examples/03-observability/)     | Spans + correlated logs            |
| [`examples/04-iac-deployments/`](./examples/04-iac-deployments/) | Serverless + Terraform snippets    |

เมื่อพร้อมแล้ว ไปทำ Lab: [`LAB.md`](./LAB.md)
