/**
 * OrderSaga demo — orchestrates Inventory, Payment, and Shipping services to
 * fulfil a checkout. Run: npx tsx saga/index.ts
 *
 * A fuller, interview-style version of this exact saga (with idempotency
 * keys and retry policy) is worked through in LAB.md, Lab 2.
 */
import { SagaOrchestrator, SagaStep } from './saga.js';

export interface OrderLineInput {
  productId: string;
  quantity: number;
}

export interface OrderSagaContext {
  readonly orderId: string;
  readonly customerId: string;
  readonly items: OrderLineInput[];
  readonly amountMinorUnits: number;
  reservationId?: string;
  chargeId?: string;
  shipmentId?: string;
}

// ====== Simulated downstream services ======

class InventoryService {
  private reservations = new Map<string, OrderLineInput[]>();

  async reserve(orderId: string, items: OrderLineInput[]): Promise<string> {
    await delay(10);
    const reservationId = `resv-${orderId}`;
    this.reservations.set(reservationId, items);
    console.log(` [Inventory] reserved ${items.length} line(s) for ${orderId} -> ${reservationId}`);
    return reservationId;
  }

  async release(reservationId: string): Promise<void> {
    await delay(10);
    this.reservations.delete(reservationId);
    console.log(` [Inventory] released reservation ${reservationId}`);
  }
}

class PaymentService {
  constructor(private readonly shouldFail: boolean = false) {}

  async charge(orderId: string, amountMinorUnits: number): Promise<string> {
    await delay(10);
    if (this.shouldFail) {
      throw new Error(`Payment gateway declined the charge for ${orderId} (insufficient funds)`);
    }
    const chargeId = `charge-${orderId}`;
    console.log(
      ` [Payment] charged ${(amountMinorUnits / 100).toFixed(2)} for ${orderId} -> ${chargeId}`,
    );
    return chargeId;
  }

  async refund(chargeId: string): Promise<void> {
    await delay(10);
    console.log(` [Payment] refunded ${chargeId}`);
  }
}

class ShippingService {
  async createShipment(orderId: string): Promise<string> {
    await delay(10);
    const shipmentId = `ship-${orderId}`;
    console.log(` [Shipping] created shipment for ${orderId} -> ${shipmentId}`);
    return shipmentId;
  }

  async cancelShipment(shipmentId: string): Promise<void> {
    await delay(10);
    console.log(` [Shipping] cancelled shipment ${shipmentId}`);
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ========== Saga steps ==========

function buildOrderSagaSteps(
  inventory: InventoryService,
  payment: PaymentService,
  shipping: ShippingService,
): SagaStep<OrderSagaContext>[] {
  const reserveInventory: SagaStep<OrderSagaContext> = {
    name: 'ReserveInventory',
    async execute(ctx) {
      ctx.reservationId = await inventory.reserve(ctx.orderId, ctx.items);
    },
    async compensate(ctx) {
      if (ctx.reservationId) await inventory.release(ctx.reservationId);
    },
  };

  const chargePayment: SagaStep<OrderSagaContext> = {
    name: 'ChargePayment',
    async execute(ctx) {
      ctx.chargeId = await payment.charge(ctx.orderId, ctx.amountMinorUnits);
    },
    async compensate(ctx) {
      if (ctx.chargeId) await payment.refund(ctx.chargeId);
    },
  };

  const createShipment: SagaStep<OrderSagaContext> = {
    name: 'CreateShipment',
    async execute(ctx) {
      ctx.shipmentId = await shipping.createShipment(ctx.orderId);
    },
    async compensate(ctx) {
      if (ctx.shipmentId) await shipping.cancelShipment(ctx.shipmentId);
    },
  };

  return [reserveInventory, chargePayment, createShipment];
}

async function main(): Promise<void> {
  console.log('=== Saga demo #1: happy path (Reserve -> Charge -> Ship, all succeed) ===\n');
  {
    const inventory = new InventoryService();
    const payment = new PaymentService(false);
    const shipping = new ShippingService();
    const orchestrator = new SagaOrchestrator(buildOrderSagaSteps(inventory, payment, shipping));

    const ctx: OrderSagaContext = {
      orderId: 'order-saga-001',
      customerId: 'cust-500',
      items: [{ productId: 'sku-mango-sticky-rice', quantity: 2 }],
      amountMinorUnits: 17000,
    };

    const result = await orchestrator.run(ctx);
    console.log('\nSaga result:', JSON.stringify(result, null, 2));
  }

  console.log(
    '\n=== Saga demo #2: payment fails after inventory was reserved -> compensation runs ===\n',
  );
  {
    const inventory = new InventoryService();
    const payment = new PaymentService(true); // simulate a declined charge
    const shipping = new ShippingService();
    const orchestrator = new SagaOrchestrator(buildOrderSagaSteps(inventory, payment, shipping));

    const ctx: OrderSagaContext = {
      orderId: 'order-saga-002',
      customerId: 'cust-501',
      items: [{ productId: 'sku-tom-yum-kit', quantity: 1 }],
      amountMinorUnits: 9900,
    };

    const result = await orchestrator.run(ctx);
    console.log('\nSaga result:', JSON.stringify(result, null, 2));
    console.log(
      `\nNote: ReserveInventory was compensated (released), ChargePayment never completed, CreateShipment never ran.`,
    );
  }
}

const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  main().catch((err) => {
    console.error('Fatal error in demo:', err);
    process.exitCode = 1;
  });
}
