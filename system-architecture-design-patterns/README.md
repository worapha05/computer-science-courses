# Zero to Expert: System Architecture & Design Patterns

Bootcamp สำหรับ Senior Engineers และ Tech Leads ที่ต้องการยกระดับจาก “เขียนโค้ดให้ทำงานได้” สู่ “ออกแบบระบบที่ขยายได้ ดูแลได้ และตัดสินใจ trade-off ได้”

## เป้าหมาย

เมื่อจบคอร์สนี้ คุณจะสามารถ:

- อธิบายและ apply **SOLID** พร้อมชี้ anti-patterns ในโค้ดจริงได้
- เลือก **Creational / Structural / Behavioral Patterns** ตามบริบท ไม่ใช่ตามชื่อ
- ออกแบบโครงสร้างโค้ดแบบ **Layered, MVC/MVVM, Hexagonal, Clean Architecture**
- ใช้แนวคิด **DDD, CQRS, Event Sourcing, Saga** ในระบบกระจาย
- วิเคราะห์ **CAP, HA, Caching, Replication, Resilience** ในการ System Design Interview

## โครงสร้างหลักสูตร

| Level               | folder                                   | เนื้อหาหลัก                                             | ระยะเวลาแนะนำ |
| ------------------- | ---------------------------------------- | ------------------------------------------------------- | ------------- |
| **1. Beginner**     | [`01-beginner/`](./01-beginner/)         | SOLID, Creational Patterns, Layered / Monolith / SoC    | 2–3 สัปดาห์   |
| **2. Intermediate** | [`02-intermediate/`](./02-intermediate/) | Structural & Behavioral Patterns, MVC/MVVM, Hexagonal   | 3–4 สัปดาห์   |
| **3. Expert**       | [`03-expert/`](./03-expert/)             | Clean Architecture, DDD, CQRS/ES, Saga, CAP, Resilience | 4–6 สัปดาห์   |

แต่ละ Level ประกอบด้วย:

1. **`README.md`** — ทฤษฎี คอนเซปต์การออกแบบ และแนวคิดเลือก Pattern (ภาษาไทย) + Best Practices
2. **`src/`** — โค้ดตัวอย่าง Clean Code ด้วย TypeScript
3. **`LAB.md`** — โจทย์ System Design / Refactor แนว Interview พร้อมเฉลยครบ

## เส้นทางการเรียน (Learning Path)

```
Beginner        Intermediate       Expert
────────        ────────────       ──────
SOLID Principles    →  Adapter / Decorator   →  Clean Architecture
Singleton / Factory / Builder →  Facade / Proxy    →  DDD (Aggregates, BC)
Layered Monolith + SoC  →  Observer / Strategy   →  CQRS + Event Sourcing
        →  State / Command    →  Saga Orchestration
        →  MVC vs MVVM vs Hexagonal  →  CAP / HA / Cache / LB
                 →  Circuit Breaker & Co.
```

## ข้อกำหนด

- Node.js 20+ และ TypeScript (รันด้วย `npx tsx`)
- ประสบการณ์เขียน OOP / backend อย่างน้อยระดับ mid–senior
- ความคุ้นเคยกับ REST API และฐานข้อมูลเชิงสัมพันธ์จะช่วยให้เข้าใจตัวอย่างเร็วขึ้น

### รันโค้ดตัวอย่าง

```bash
cd system-architecture-design-patterns/01-beginner/src
npm install
npx tsx solid/srp.ts
npx tsx creational/singleton/singleton.ts

cd ../../02-intermediate/src
npm install
npx tsx structural/adapter/adapter.ts

cd ../../03-expert/src
npm install
npx tsx clean-architecture/index.ts
npx tsx saga/index.ts
```

## วิธีใช้ Bootcamp อย่างมีประสิทธิภาพ

1. **อ่าน README** ของ Level ให้จบ — โฟกัสที่ “เมื่อไหร่ใช้ / เมื่อไหร่ไม่ใช้”
2. **รันและแก้โค้ดใน `src/`** — ลองเพิ่ม use case ใหม่เอง
3. **ทำ LAB โดยไม่ดูเฉลยก่อน** — จำกัดเวลา 45–90 นาทีต่อข้อ (แนว interview)
4. **เขียน trade-off** เป็นข้อความสั้น ๆ ก่อนลงโค้ด (Consistency vs Availability, Coupling vs Flexibility)
5. **Review กับทีม** — ใช้ LAB เป็นแบบฝึก whiteboard ในทีม tech lead

## ความสัมพันธ์กับ System Design Interview

| หัวข้อใน Bootcamp              | ปรากฏใน Interview บ่อยแค่ไหน |
| ------------------------------ | ---------------------------- |
| SOLID / SoC / Layered          | ★★★★☆ (โค้ด + design review) |
| Adapter / Strategy / Observer  | ★★★★☆                        |
| Hexagonal / Clean Architecture | ★★★★☆                        |
| CAP / Caching / Load Balancing | ★★★★★                        |
| CQRS / Event Sourcing / Saga   | ★★★★☆                        |
| Circuit Breaker / Rate Limit   | ★★★★☆                        |
