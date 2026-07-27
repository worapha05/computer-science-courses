/**
 * STATE PATTERN — Order Lifecycle (Pending -> Paid -> Shipped -> Delivered)
 * ----------------------------------------------------------------
 * TH: State ให้ object เปลี่ยน "พฤติกรรม" ตามสถานะภายในของมันเอง โดยย้าย
 *  if/switch ตามสถานะ ออกไปเป็น class ละสถานะ แต่ละ class รู้ว่าจากสถานะ
 *  นี้ ไปสถานะไหนได้บ้าง (legal transitions) และทำอะไรตอนเปลี่ยน
 * EN: State lets an object change behavior based on its internal state by
 *  moving state-based if/switch logic into one class per state. Each class
 *  knows its own legal transitions and side effects.
 *
 * State vs Strategy:
 * TH: โครงสร้างคล้ายกันมาก (ทั้งคู่ inject object ที่ implement interface เดียวกัน)
 *  แต่ต่างที่ "ใครเปลี่ยน" — Strategy: caller/context เปลี่ยน strategy จากภายนอก
 *  ตามการตั้งค่า, State: state เปลี่ยน "ตัวเอง" เป็น state ถัดไปจากภายใน
 *  ตาม transition rule (self-transition)
 * EN: Structurally similar, but who changes it differs — Strategy: the caller
 *  swaps strategies externally. State: the state transitions itself
 *  internally based on transition rules.
 *
 * Anti-pattern ที่พบบ่อย: เขียน State pattern แต่ยังปล่อยให้ context เช็ค
 * `if (state instanceof PaidState)` จากภายนอก — เท่ากับย้าย switch ไปไว้ผิดที่
 * แทนที่จะกำจัดมัน
 *
 * รันตัวอย่าง / Run:
 * npx tsx behavioral/state/state.ts
 */

// ============================================================================
// 1) STATE INTERFACE
// ============================================================================

export interface OrderState {
  readonly name: string;
  pay(order: OrderContext): void;
  ship(order: OrderContext): void;
  deliver(order: OrderContext): void;
  cancel(order: OrderContext): void;
}

// ============================================================================
// 2) BASE STATE — default: ปฏิเสธทุก transition (subclass override เฉพาะที่อนุญาต)
// ============================================================================

abstract class BaseOrderState implements OrderState {
  abstract readonly name: string;

  pay(order: OrderContext): void {
    this.reject(order, 'pay');
  }
  ship(order: OrderContext): void {
    this.reject(order, 'ship');
  }
  deliver(order: OrderContext): void {
    this.reject(order, 'deliver');
  }
  cancel(order: OrderContext): void {
    this.reject(order, 'cancel');
  }

  protected reject(order: OrderContext, action: string): void {
    throw new Error(
      `Invalid transition: cannot "${action}" an order in state "${this.name}" (order ${order.orderId})`,
    );
  }
}

// ============================================================================
// 3) CONCRETE STATES
// ============================================================================

class PendingState extends BaseOrderState {
  readonly name = 'Pending';

  override pay(order: OrderContext): void {
    console.log(` [Pending] payment received for ${order.orderId} -> Paid`);
    order.transitionTo(new PaidState());
  }

  override cancel(order: OrderContext): void {
    console.log(` [Pending] cancelling ${order.orderId} -> Cancelled`);
    order.transitionTo(new CancelledState());
  }
}

class PaidState extends BaseOrderState {
  readonly name = 'Paid';

  override ship(order: OrderContext): void {
    console.log(` [Paid] shipment dispatched for ${order.orderId} -> Shipped`);
    order.transitionTo(new ShippedState());
  }

  override cancel(order: OrderContext): void {
    // TH: ยกเลิกได้แม้จ่ายแล้ว แต่ต้องมี refund logic แยกออกไป (ไม่ผสมกับ state transition)
    console.log(` [Paid] cancelling paid order ${order.orderId}, triggering refund -> Cancelled`);
    order.transitionTo(new CancelledState());
  }
}

class ShippedState extends BaseOrderState {
  readonly name = 'Shipped';

  override deliver(order: OrderContext): void {
    console.log(` [Shipped] delivery confirmed for ${order.orderId} -> Delivered`);
    order.transitionTo(new DeliveredState());
  }

  // TH: หมายเหตุ: ของที่ shipped แล้วมักจะ "cancel ไม่ได้" ต้องใช้ flow คืนสินค้า (return) แทน
  //  เราจึงไม่ override cancel() ที่นี่ ปล่อยให้ base class ปฏิเสธ
}

class DeliveredState extends BaseOrderState {
  readonly name = 'Delivered';
  // TH: terminal state — ไม่ override อะไรเลย ทุก action ถูกปฏิเสธโดย base class
  // EN: terminal state — no overrides, every action is rejected by the base class
}

class CancelledState extends BaseOrderState {
  readonly name = 'Cancelled';
  // TH: terminal state เช่นกัน
}

// ============================================================================
// 4) CONTEXT
// ============================================================================

export class OrderContext {
  private state: OrderState = new PendingState();
  readonly history: string[] = [];

  constructor(readonly orderId: string) {
    this.history.push(this.state.name);
  }

  get currentState(): string {
    return this.state.name;
  }

  transitionTo(state: OrderState): void {
    this.state = state;
    this.history.push(state.name);
  }

  pay(): void {
    this.state.pay(this);
  }
  ship(): void {
    this.state.ship(this);
  }
  deliver(): void {
    this.state.deliver(this);
  }
  cancel(): void {
    this.state.cancel(this);
  }
}

// ============================================================================
// DEMO
// ============================================================================

function demo() {
  console.log('== State Pattern: Order lifecycle ==\n');

  console.log('--- Happy path: Pending -> Paid -> Shipped -> Delivered ---');
  const order1 = new OrderContext('ORD-1');
  console.log(` state=${order1.currentState}`);
  order1.pay();
  order1.ship();
  order1.deliver();
  console.log(` final state=${order1.currentState}, history=${order1.history.join(' -> ')}`);

  console.log('\n--- Invalid transition: deliver() before pay()/ship() ---');
  const order2 = new OrderContext('ORD-2');
  try {
    order2.deliver();
  } catch (err) {
    console.log(` Rejected as expected: ${(err as Error).message}`);
  }

  console.log('\n--- Cancel after payment (refund path) ---');
  const order3 = new OrderContext('ORD-3');
  order3.pay();
  order3.cancel();
  console.log(` final state=${order3.currentState}, history=${order3.history.join(' -> ')}`);

  console.log('\n--- Cancel after shipped: rejected, must use return flow instead ---');
  const order4 = new OrderContext('ORD-4');
  order4.pay();
  order4.ship();
  try {
    order4.cancel();
  } catch (err) {
    console.log(` Rejected as expected: ${(err as Error).message}`);
  }
}

const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  demo();
}
