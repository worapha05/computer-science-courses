# NovaMart Runbook — Canary, Multi-region, War-Room

## Progressive delivery (Canary)

1. Deploy version ใหม่เป็น alias `checkout:v2` โดย traffic 0%
2. Bake 5 นาที ดู alarms สังเคราะห์ (errors, p99)
3. เปิด **10%** → เฝ้า 10 นาที
4. เปิด **50%** → เฝ้า 15 นาที
5. เปิด **100%**
6. ถ้า `Errors >= threshold` หรือ p99 เกิน SLO → **rollback ทันที** ไป v1

อ้างอิงแผนใน `examples/04-iac-deployments/traffic-shift.json`

### AWS

- Lambda weighted alias / CodeDeploy canary
- Alarm ผูกกับ rollback อัตโนมัติ

### GCP

- Cloud Run `--to-revisions=BLUE=90,GREEN=10`
- หรือ Cloud Functions gen2 ผ่าน Cloud Run traffic

## Multi-region (active-passive ขั้นต่ำ)

| รายการ    | ค่าแนะนำ                                        |
| --------- | ----------------------------------------------- |
| Primary   | `ap-southeast-1`                                |
| Secondary | `ap-northeast-1` (หรือใกล้ผู้ใช้สำรอง)          |
| DNS       | Failover / health check ที่ gateway             |
| Data      | DB replicate หรือแยก region + reconcile ออเดอร์ |
| Secrets   | replicate secret / ใช้ manager แบบ multi-region |

อย่าเปิด active-active จนกว่าจะมีกลยุทธ์ conflict ของออเดอร์และสต็อกชัด

## War-room checklist (15 นาทีแรก)

1. ยืนยัน blast radius: checkout เท่านั้น หรือ homepage ด้วย?
2. ดู dashboard: payment latency, error rate, circuit state, Lambda concurrency
3. เปิด trace ของ `correlationId` จากลูกค้าที่พลาด
4. ถ้า payment provider พัง: เปิด circuit / ปิด retry ก้าวร้าว / คง degradation ของ homepage
5. สื่อสารสถานะออเดอร์ `accepted` vs `paid` ให้ CS ชัดเจน
6. หลังนิ่ง: postmortem + ใส่ test สำหรับ retry storm และ homepage bulkhead

## IaC

- ห้ามแก้ alarm/traffic ใน console แล้วลืม — เก็บใน Terraform/Serverless PR
- ทุก release ต้องมี rollback path ที่ซ้อมแล้ว
