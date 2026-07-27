/**
 * FACADE PATTERN — Order Checkout Facade (Inventory + Payment + Shipping)
 * ----------------------------------------------------------------
 * TH: Facade ให้ interface ง่าย ๆ หน้าเดียว คลุม subsystem ที่ซับซ้อนหลายตัว
 *  (inventory, payment, shipping, notification) ผู้เรียกไม่ต้องรู้ลำดับ
 *  การเรียก, ไม่ต้องรู้ error handling ของแต่ละ subsystem, ไม่ผูกกับ
 *  รายละเอียดภายใน
 * EN: Facade provides one simple entry point over several complex subsystems.
 *  Callers don't need to know call order, per-subsystem error handling,
 *  or internal details.
 *
 * ข้อควรระวัง: Facade ไม่ใช่ "God Object" — มันไม่ควรมี business logic เยอะ
 * มันแค่ "orchestrate" (เรียกใครก่อนหลัง, rollback ยังไง) ส่วน logic จริง
 * ยังอยู่ใน subsystem เดิม
 *
 * รันตัวอย่าง / Run:
 * npx tsx structural/facade/facade.ts
 */

// ============================================================================
// SUBSYSTEMS — แต่ละตัวมี interface/state ของตัวเอง ซับซ้อนในแบบของมันเอง
// ============================================================================

class InventoryService {
  private stock = new Map<string, number>([
    ['SKU-001', 5],
    ['SKU-002', 0],
  ]);

  checkAvailability(sku: string, qty: number): boolean {
    const available = this.stock.get(sku) ?? 0;
    console.log(` [Inventory] check ${sku}: available=${available}, requested=${qty}`);
    return available >= qty;
  }

  reserve(sku: string, qty: number): void {
    const current = this.stock.get(sku) ?? 0;
    this.stock.set(sku, current - qty);
    console.log(` [Inventory] reserved ${qty}x ${sku}, remaining=${current - qty}`);
  }

  release(sku: string, qty: number): void {
    const current = this.stock.get(sku) ?? 0;
    this.stock.set(sku, current + qty);
    console.log(` [Inventory] released ${qty}x ${sku} back to stock (compensation)`);
  }
}

class PaymentService {
  charge(customerId: string, amountCents: number): { success: boolean; transactionId: string } {
    console.log(` [Payment] charging ${customerId} for ${amountCents} cents`);
    // TH: สมมติว่าลูกค้าที่ id ลงท้ายด้วย "9" การ์ดถูก decline เพื่อโชว์ rollback
    const declined = customerId.endsWith('9');
    if (declined) {
      console.log(` [Payment] DECLINED for ${customerId}`);
      return { success: false, transactionId: '' };
    }
    const transactionId = `TXN-${Date.now()}`;
    console.log(` [Payment] SUCCESS transactionId=${transactionId}`);
    return { success: true, transactionId };
  }

  refund(transactionId: string): void {
    console.log(` [Payment] refunded transactionId=${transactionId} (compensation)`);
  }
}

class ShippingService {
  scheduleShipment(orderId: string, address: string): { trackingId: string } {
    const trackingId = `TRACK-${orderId}`;
    console.log(` [Shipping] scheduled shipment to "${address}" trackingId=${trackingId}`);
    return { trackingId };
  }
}

class NotificationService {
  sendOrderConfirmation(customerId: string, orderId: string): void {
    console.log(` [Notification] email sent to ${customerId}: order ${orderId} confirmed`);
  }

  sendOrderFailed(customerId: string, reason: string): void {
    console.log(` [Notification] email sent to ${customerId}: order failed (${reason})`);
  }
}

// ============================================================================
// FACADE — จุดเดียวที่ caller ต้องรู้จัก
// ============================================================================

export interface CheckoutRequest {
  orderId: string;
  customerId: string;
  sku: string;
  qty: number;
  amountCents: number;
  shippingAddress: string;
}

export type CheckoutResult =
  | { status: 'success'; transactionId: string; trackingId: string }
  | { status: 'out_of_stock' }
  | { status: 'payment_declined' };

export class OrderCheckoutFacade {
  constructor(
    private readonly inventory: InventoryService = new InventoryService(),
    private readonly payment: PaymentService = new PaymentService(),
    private readonly shipping: ShippingService = new ShippingService(),
    private readonly notifications: NotificationService = new NotificationService(),
  ) {}

  /**
   * TH: orchestrate ทั้ง flow: ตรวจสต็อก -> จองสต็อก -> เก็บเงิน -> จัดส่ง -> แจ้งเตือน
   *  ถ้าขั้นไหนล้มเหลว ต้อง "compensate" (rollback) ขั้นก่อนหน้าให้ถูกต้อง
   * EN: orchestrates the full flow, compensating (rolling back) prior steps
   *  whenever a later step fails — this is the value the Facade adds.
   */
  checkout(req: CheckoutRequest): CheckoutResult {
    console.log(`\n== Checkout order ${req.orderId} for ${req.customerId} ==`);

    if (!this.inventory.checkAvailability(req.sku, req.qty)) {
      this.notifications.sendOrderFailed(req.customerId, 'out_of_stock');
      return { status: 'out_of_stock' };
    }

    this.inventory.reserve(req.sku, req.qty);

    const paymentResult = this.payment.charge(req.customerId, req.amountCents);
    if (!paymentResult.success) {
      // TH: compensation — ต้องปล่อยสต็อกที่จองไว้กลับคืน เพราะเงินไม่เข้า
      this.inventory.release(req.sku, req.qty);
      this.notifications.sendOrderFailed(req.customerId, 'payment_declined');
      return { status: 'payment_declined' };
    }

    const shipmentResult = this.shipping.scheduleShipment(req.orderId, req.shippingAddress);
    this.notifications.sendOrderConfirmation(req.customerId, req.orderId);

    return {
      status: 'success',
      transactionId: paymentResult.transactionId,
      trackingId: shipmentResult.trackingId,
    };
  }
}

// ============================================================================
// DEMO
// ============================================================================

function demo() {
  console.log('== Facade Pattern: OrderCheckoutFacade ==');
  const facade = new OrderCheckoutFacade();

  const success = facade.checkout({
    orderId: 'ORD-1',
    customerId: 'cust-100',
    sku: 'SKU-001',
    qty: 2,
    amountCents: 5000,
    shippingAddress: '123 Bangkok Rd.',
  });
  console.log('Result:', success);

  const outOfStock = facade.checkout({
    orderId: 'ORD-2',
    customerId: 'cust-101',
    sku: 'SKU-002',
    qty: 1,
    amountCents: 2000,
    shippingAddress: '456 Chiang Mai Rd.',
  });
  console.log('Result:', outOfStock);

  const declined = facade.checkout({
    orderId: 'ORD-3',
    customerId: 'cust-109', // ลงท้ายด้วย 9 -> การ์ดถูก decline
    sku: 'SKU-001',
    qty: 1,
    amountCents: 3000,
    shippingAddress: '789 Phuket Rd.',
  });
  console.log('Result:', declined);
}

const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  demo();
}
