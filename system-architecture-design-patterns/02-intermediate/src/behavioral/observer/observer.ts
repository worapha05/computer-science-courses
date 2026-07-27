/**
 * OBSERVER PATTERN — Order Status Subject with Email/Analytics/Inventory Observers
 * ----------------------------------------------------------------
 * TH: Observer ให้ object หนึ่ง (Subject/Publisher) แจ้ง object อื่นหลายตัว
 *  (Observers/Subscribers) เมื่อสถานะเปลี่ยน โดย Subject ไม่ต้องรู้จัก
 *  รายละเอียดของ Observer เลย แค่รู้ว่ามัน implement interface อะไร
 *  นี่คือ "event-driven baseline" ที่ระบบใหญ่ ๆ (message queue, webhook,
 *  DOM events, React state) ต่อยอดมาจากแนวคิดนี้ทั้งนั้น
 * EN: Observer lets one Subject notify many Observers on state change, without
 *  the Subject knowing observer details — just the interface. This is the
 *  conceptual baseline for message queues, webhooks, DOM events, and React
 *  state updates.
 *
 * Anti-pattern ที่พบบ่อย:
 * TH: 1) Observer ที่ throw exception ตัวหนึ่งทำให้ observer ตัวอื่นไม่ได้รับ
 *  notify (ต้อง isolate error ต่อ observer)
 *  2) Memory leak จากการไม่ unsubscribe (โดยเฉพาะใน frontend)
 *  3) Observer ที่แก้ state ของ subject กลับ (circular update) ทำให้ debug ยาก
 *  4) ใช้ Observer แทน request/response ที่ต้องการคำตอบทันที (ควรใช้ function call ตรง ๆ)
 *
 * รันตัวอย่าง / Run:
 * npx tsx behavioral/observer/observer.ts
 */

// ============================================================================
// 1) EVENT TYPES
// ============================================================================

export type OrderStatus = 'created' | 'paid' | 'shipped' | 'delivered' | 'cancelled';

export interface OrderEvent {
  orderId: string;
  status: OrderStatus;
  timestamp: number;
}

// ============================================================================
// 2) OBSERVER INTERFACE
// ============================================================================

export interface OrderObserver {
  readonly name: string;
  onOrderStatusChanged(event: OrderEvent): void;
}

// ============================================================================
// 3) SUBJECT (Publisher) — generic, reusable EventBus-style subject
// ============================================================================

export class OrderStatusSubject {
  private readonly observers = new Set<OrderObserver>();

  subscribe(observer: OrderObserver): () => void {
    this.observers.add(observer);
    console.log(` [Subject] subscribed: ${observer.name}`);
    // TH: คืน "unsubscribe function" ตรง ๆ — ป้องกัน memory leak ได้ง่ายกว่าการ
    //  เก็บ reference แยกไว้เรียก unsubscribe เอง
    // EN: returning an unsubscribe closure makes cleanup harder to forget
    return () => this.unsubscribe(observer);
  }

  unsubscribe(observer: OrderObserver): void {
    this.observers.delete(observer);
    console.log(` [Subject] unsubscribed: ${observer.name}`);
  }

  notify(event: OrderEvent): void {
    console.log(
      ` [Subject] notifying ${this.observers.size} observer(s) of order ${event.orderId} -> ${event.status}`,
    );
    for (const observer of this.observers) {
      try {
        // TH: isolate error ต่อ observer — ตัวหนึ่งพังไม่ควรกระทบตัวอื่น
        // EN: isolate failures per-observer so one bad observer can't block the rest
        observer.onOrderStatusChanged(event);
      } catch (err) {
        console.error(` [Subject] observer "${observer.name}" threw:`, (err as Error).message);
      }
    }
  }
}

// ============================================================================
// 4) CONCRETE OBSERVERS
// ============================================================================

export class EmailNotificationObserver implements OrderObserver {
  readonly name = 'EmailNotificationObserver';

  onOrderStatusChanged(event: OrderEvent): void {
    if (event.status === 'shipped' || event.status === 'delivered') {
      console.log(` [Email] sending "${event.status}" email for order ${event.orderId}`);
    }
  }
}

export class AnalyticsObserver implements OrderObserver {
  readonly name = 'AnalyticsObserver';
  private readonly counts = new Map<OrderStatus, number>();

  onOrderStatusChanged(event: OrderEvent): void {
    this.counts.set(event.status, (this.counts.get(event.status) ?? 0) + 1);
    console.log(` [Analytics] tracked event, running totals:`, Object.fromEntries(this.counts));
  }
}

export class InventoryObserver implements OrderObserver {
  readonly name = 'InventoryObserver';

  onOrderStatusChanged(event: OrderEvent): void {
    if (event.status === 'cancelled') {
      console.log(` [Inventory] releasing reserved stock for order ${event.orderId}`);
    }
    if (event.status === 'paid') {
      console.log(` [Inventory] committing reserved stock for order ${event.orderId}`);
    }
  }
}

/** TH: observer ที่ตั้งใจ throw เพื่อโชว์ว่า Subject ต้อง isolate error ได้
 * EN: an observer that deliberately throws, to prove the Subject isolates errors */
export class FaultyWebhookObserver implements OrderObserver {
  readonly name = 'FaultyWebhookObserver';

  onOrderStatusChanged(_event: OrderEvent): void {
    throw new Error('simulated webhook endpoint timeout');
  }
}

// ============================================================================
// DEMO
// ============================================================================

function demo() {
  console.log('== Observer Pattern: Order lifecycle notifications ==\n');

  const subject = new OrderStatusSubject();
  const email = new EmailNotificationObserver();
  const analytics = new AnalyticsObserver();
  const inventory = new InventoryObserver();
  const faultyWebhook = new FaultyWebhookObserver();

  subject.subscribe(email);
  subject.subscribe(analytics);
  const unsubscribeInventory = subject.subscribe(inventory);
  subject.subscribe(faultyWebhook);

  console.log('\n--- Order created ---');
  subject.notify({ orderId: 'ORD-1', status: 'created', timestamp: Date.now() });

  console.log('\n--- Order paid (faulty observer throws but others still run) ---');
  subject.notify({ orderId: 'ORD-1', status: 'paid', timestamp: Date.now() });

  console.log('\n--- Unsubscribing InventoryObserver ---');
  unsubscribeInventory();

  console.log('\n--- Order shipped (Inventory no longer notified) ---');
  subject.notify({ orderId: 'ORD-1', status: 'shipped', timestamp: Date.now() });

  console.log('\n--- Order delivered ---');
  subject.notify({ orderId: 'ORD-1', status: 'delivered', timestamp: Date.now() });
}

const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  demo();
}
