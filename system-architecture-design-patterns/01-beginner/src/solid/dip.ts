/**
 * SOLID — Dependency Inversion Principle (DIP)
 * ================================================
 * "High-level modules should not depend on low-level modules; both should
 * depend on abstractions. Abstractions should not depend on details;
 * details should depend on abstractions."
 * (module ระดับสูง (business logic) ไม่ควรผูกติดกับ module ระดับล่าง (รายละเอียดการ implement)
 * ทั้งสองฝั่งควรพึ่งพา "สัญญา" (abstraction) กลางร่วมกัน)
 *
 * ตัวอย่างนี้จำลอง OrderService ที่ต้อง (1) เก็บออเดอร์ลงฐานข้อมูล และ (2) แจ้งเตือนลูกค้า
 * - ❌ ANTI-PATTERN: OrderService (high-level) new MySqlDatabase() ตรง ๆ (low-level detail)
 * - ✅ REFACTORED: OrderService depend on OrderRepository / NotificationSender (abstraction)
 * แล้ว "inject" การ implement จริงเข้ามาจากภายนอก (Dependency Injection)
 */

interface Order {
  readonly id: string;
  readonly customerEmail: string;
  readonly totalAmount: number;
}

// ===========================================================================
// ❌ ANTI-PATTERN: high-level module ผูกติดกับ low-level module ตรง ๆ
// ===========================================================================
// ปัญหา:
// 1. OrderService "new" MySqlDatabase และ SmtpEmailSender เองภายในตัวมัน
// -> ทดสอบ unit test ไม่ได้เลยโดยไม่แตะ MySQL/SMTP จริง
// 2. ถ้าธุรกิจอยากเปลี่ยนจาก MySQL เป็น PostgreSQL หรือ DynamoDB
// ต้องเข้ามาแก้ OrderService ทั้งที่ business logic (การสร้างออเดอร์) ไม่ได้เปลี่ยนเลย
// 3. ทิศทางของ dependency คือ "high-level -> low-level" ตรง ๆ ซึ่งขัดกับ DIP

class MySqlDatabaseAntiPattern {
  insertOrder(order: Order): void {
    console.log(
      `[MySQL] INSERT INTO orders (id, total) VALUES ('${order.id}', ${order.totalAmount})`,
    );
  }
}

class SmtpEmailSenderAntiPattern {
  send(to: string, message: string): void {
    console.log(`[SMTP] Sending email to ${to}: "${message}"`);
  }
}

class OrderServiceAntiPattern {
  // ❌ ละเมิด DIP: high-level module (OrderService) ผูกติดกับ low-level module
  // (MySqlDatabaseAntiPattern, SmtpEmailSenderAntiPattern) โดยตรงผ่านการ "new" เอง
  private readonly database = new MySqlDatabaseAntiPattern();
  private readonly emailSender = new SmtpEmailSenderAntiPattern();

  placeOrder(order: Order): void {
    this.database.insertOrder(order);
    this.emailSender.send(order.customerEmail, `Your order ${order.id} has been placed!`);
  }
}

// ===========================================================================
// ✅ REFACTORED: ทั้งสองฝั่งพึ่งพา abstraction กลาง (interface)
// ===========================================================================
// แนวคิด:
// 1. นิยาม interface (abstraction) ที่ high-level module ต้องการ:
// OrderRepository, NotificationSender
// 2. High-level module (OrderService) รับ dependency ผ่าน constructor
// (Dependency Injection) — ไม่รู้จักและไม่สนใจว่า implementation จริงคืออะไร
// 3. Low-level module (MySqlOrderRepository, SmtpNotificationSender)
// ก็ implement ตาม abstraction เดียวกัน — ทำให้ "ทิศทาง dependency" ชี้เข้าสู่ abstraction
// ไม่ใช่ high-level module ชี้ลงไปหา low-level module ตรง ๆ อีกต่อไป

interface OrderRepository {
  save(order: Order): void;
}

interface NotificationSender {
  send(to: string, message: string): void;
}

/** Low-level detail #1: การ implement จริงด้วย MySQL */
class MySqlOrderRepository implements OrderRepository {
  save(order: Order): void {
    console.log(
      `[MySQL] INSERT INTO orders (id, total) VALUES ('${order.id}', ${order.totalAmount})`,
    );
  }
}

/** Low-level detail #2: การ implement จริงแบบ in-memory (มีประโยชน์มากตอนเขียนเทส) */
class InMemoryOrderRepository implements OrderRepository {
  private readonly storage = new Map<string, Order>();

  save(order: Order): void {
    this.storage.set(order.id, order);
    console.log(`[InMemory] Stored order ${order.id} (total: ${this.storage.size} orders)`);
  }

  findById(id: string): Order | undefined {
    return this.storage.get(id);
  }
}

class SmtpNotificationSender implements NotificationSender {
  send(to: string, message: string): void {
    console.log(`[SMTP] Sending email to ${to}: "${message}"`);
  }
}

/** Low-level detail อีกแบบ: ส่งผ่าน LINE Notify แทนอีเมล — สลับได้โดยไม่แก้ OrderService */
class LineNotifySender implements NotificationSender {
  send(to: string, message: string): void {
    console.log(`[LINE Notify] -> ${to}: "${message}"`);
  }
}

/**
 * OrderService คือ "high-level module" ที่รู้จักแค่ abstraction (OrderRepository,
 * NotificationSender) เท่านั้น ไม่รู้และไม่สนใจว่าเบื้องหลังเป็น MySQL, Postgres,
 * SMTP หรือ LINE Notify — เป็นไปตามหลัก DIP อย่างสมบูรณ์
 */
class OrderService {
  constructor(
    private readonly repository: OrderRepository,
    private readonly notifier: NotificationSender,
  ) {}

  placeOrder(order: Order): void {
    this.repository.save(order);
    this.notifier.send(order.customerEmail, `Your order ${order.id} has been placed!`);
  }
}

// ===========================================================================
// Demo
// ===========================================================================

const sampleOrder: Order = {
  id: 'ORD-9001',
  customerEmail: 'customer@example.com',
  totalAmount: 1990,
};

function runDemo(): void {
  console.log('--- ❌ Anti-pattern: OrderService hard-wired to MySQL + SMTP ---');
  new OrderServiceAntiPattern().placeOrder(sampleOrder);

  console.log('\n--- ✅ Refactored: OrderService depends on abstractions (production wiring) ---');
  const prodService = new OrderService(new MySqlOrderRepository(), new SmtpNotificationSender());
  prodService.placeOrder(sampleOrder);

  console.log('\n--- ✅ Same OrderService, different low-level details (test/dev wiring) ---');
  const testRepo = new InMemoryOrderRepository();
  const testService = new OrderService(testRepo, new LineNotifySender());
  testService.placeOrder({ ...sampleOrder, id: 'ORD-9002' });
  console.log('Verify without touching real DB:', testRepo.findById('ORD-9002'));

  console.log(
    '\nสังเกต: OrderService ตัวเดียวกัน ทำงานได้ทั้งกับ MySQL+SMTP (production) และ ' +
      'InMemory+LineNotify (test/dev) โดยไม่ต้องแก้ไขโค้ดใน OrderService แม้แต่บรรทัดเดียว ' +
      "นี่คือประโยชน์หลักของการ 'invert' ทิศทาง dependency ให้ชี้เข้า abstraction",
  );
}

const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  runDemo();
}

export {
  OrderServiceAntiPattern,
  OrderService,
  MySqlOrderRepository,
  InMemoryOrderRepository,
  SmtpNotificationSender,
  LineNotifySender,
};
export type { Order, OrderRepository, NotificationSender };
