/**
 * HEXAGONAL ARCHITECTURE (Ports & Adapters) — Order Placement Use Case
 * ----------------------------------------------------------------
 * TH: แนวคิดหลัก: business logic (core/domain) อยู่ตรงกลาง ไม่รู้จักเทคโนโลยี
 *  ภายนอกใด ๆ เลย (ไม่รู้จัก HTTP, ไม่รู้จัก Postgres, ไม่รู้จัก SMTP) มันคุย
 *  กับโลกภายนอกผ่าน "Port" (interface) เท่านั้น
 *
 *  - Inbound Port (Driving Port): ทางเข้าสู่ core — ตัวอย่างคือ use case
 *  interface ที่ adapter ด้านนอก (HTTP controller, CLI, message consumer)
 *  เรียกเข้ามา
 *  - Outbound Port (Driven Port): ทางที่ core "ต้องการ" จากโลกภายนอก —
 *  เช่น Repository (เก็บข้อมูล), Notifier (แจ้งเตือน) เป็น interface ที่
 *  core กำหนดขึ้นเอง แล้วให้ adapter ไป implement
 *  - Adapter: ตัวเชื่อมจริงระหว่าง Port กับเทคโนโลยีจริง (HTTP framework,
 *  DB driver, message queue client) — สามารถสลับได้โดยไม่แก้ core เลย
 *
 *  กฎทองคือ "Dependency Rule": arrow ของ dependency ต้องชี้ "เข้า" หา core
 *  เสมอ (adapters depend on ports/core, core ไม่รู้จัก adapters)
 *
 * EN: Core idea: business logic (the domain core) sits in the middle, unaware
 *  of any external technology (no HTTP, no Postgres, no SMTP knowledge). It
 *  only talks to the outside world through Ports (interfaces).
 *
 *  - Inbound Port: entry point into the core (a use case interface) that
 *  outer adapters (HTTP controller, CLI, message consumer) call.
 *  - Outbound Port: something the core *needs* from the outside world
 *  (Repository, Notifier) — an interface the core defines, that adapters
 *  implement.
 *  - Adapter: the real bridge between a Port and actual technology (HTTP
 *  framework, DB driver, MQ client) — swappable without touching the core.
 *
 *  Golden rule: the Dependency Rule — dependencies always point INWARD
 *  toward the core; adapters depend on ports/core, never the reverse.
 *
 * ```
 *   ┌─────────────────────────────────────────────┐
 *   │     ADAPTERS (outer)    │
 *   │ ┌───────────┐    ┌──────────────┐ │
 *   │ │HTTP Ctrl │──inbound────▶│    │ │
 * Client ─┼─▶│(driving) │ port  │    │ │
 *   │ └───────────┘    │ CORE /  │ │
 *   │        │ DOMAIN  │ │
 *   │ ┌───────────┐    │ (use cases, │ │
 *   │ │InMemory │◀─outbound────│ entities) │ │
 *   │ │Repository │ port  │    │ │
 *   │ │(driven) │    └──────────────┘ │
 *   │ └───────────┘      ▲   │
 *   │ ┌───────────┐      │outbound │
 *   │ │Console │◀────────────────────┘port  │
 *   │ │Notifier │        │
 *   │ └───────────┘        │
 *   └─────────────────────────────────────────────┘
 * ```
 *
 * รันตัวอย่าง / Run:
 * npx tsx architecture/hexagonal/hexagonal.ts
 */

// ============================================================================
// DOMAIN (CORE) — Entities: pure data + invariants, zero external dependency
// ============================================================================

export interface Order {
  id: string;
  customerId: string;
  sku: string;
  qty: number;
  totalCents: number;
  status: 'placed';
  createdAt: number;
}

export class InsufficientStockError extends Error {
  constructor(sku: string) {
    super(`Insufficient stock for SKU ${sku}`);
  }
}

// ============================================================================
// OUTBOUND PORTS (Driven) — สิ่งที่ core "ต้องการ" จากโลกภายนอก
// TH: core กำหนด interface นี้ขึ้นมาเอง ไม่ใช่ adapter กำหนด — สำคัญมาก!
// EN: the core defines this interface itself, NOT the adapter — this matters!
// ============================================================================

export interface ProductLookup {
  getPrice(sku: string): number | null;
  getStock(sku: string): number;
}

export interface OrderRepositoryPort {
  save(order: Order): Promise<void>;
  findById(id: string): Promise<Order | null>;
}

export interface NotifierPort {
  notifyOrderPlaced(order: Order): Promise<void>;
}

// ============================================================================
// INBOUND PORT (Driving) — ทางเข้าสู่ core ที่ adapter ด้านนอกจะเรียก
// ============================================================================

export interface PlaceOrderInput {
  customerId: string;
  sku: string;
  qty: number;
}

export interface PlaceOrderUseCase {
  execute(input: PlaceOrderInput): Promise<Order>;
}

// ============================================================================
// CORE — use case implementation. รู้จักแค่ Ports ทั้งหมด ไม่รู้จัก HTTP/DB จริง
// ============================================================================

export class PlaceOrderService implements PlaceOrderUseCase {
  constructor(
    private readonly products: ProductLookup,
    private readonly orders: OrderRepositoryPort,
    private readonly notifier: NotifierPort,
  ) {}

  async execute(input: PlaceOrderInput): Promise<Order> {
    const stock = this.products.getStock(input.sku);
    if (stock < input.qty) throw new InsufficientStockError(input.sku);

    const price = this.products.getPrice(input.sku);
    if (price === null) throw new Error(`Unknown SKU ${input.sku}`);

    const order: Order = {
      id: `ord-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      customerId: input.customerId,
      sku: input.sku,
      qty: input.qty,
      totalCents: price * input.qty,
      status: 'placed',
      createdAt: Date.now(),
    };

    await this.orders.save(order);
    await this.notifier.notifyOrderPlaced(order);
    return order;
  }
}

// ============================================================================
// OUTBOUND ADAPTERS — implement outbound ports ด้วยเทคโนโลยีจริง (ในตัวอย่างนี้
// เป็น in-memory เพื่อให้รันได้เอง แต่ในการใช้งานจริงจะเป็น Postgres/SES/etc.)
// ============================================================================

export class InMemoryProductLookup implements ProductLookup {
  private readonly catalog = new Map<string, { priceCents: number; stock: number }>([
    ['SKU-001', { priceCents: 25000, stock: 8 }],
    ['SKU-002', { priceCents: 15000, stock: 0 }],
  ]);

  getPrice(sku: string): number | null {
    return this.catalog.get(sku)?.priceCents ?? null;
  }

  getStock(sku: string): number {
    return this.catalog.get(sku)?.stock ?? 0;
  }
}

export class InMemoryOrderRepository implements OrderRepositoryPort {
  private readonly store = new Map<string, Order>();

  async save(order: Order): Promise<void> {
    console.log(` [InMemoryOrderRepository] saving order ${order.id}`);
    this.store.set(order.id, order);
  }

  async findById(id: string): Promise<Order | null> {
    return this.store.get(id) ?? null;
  }
}

export class ConsoleNotifier implements NotifierPort {
  async notifyOrderPlaced(order: Order): Promise<void> {
    console.log(
      ` [ConsoleNotifier] (would send email/SMS) order ${order.id} placed for ${order.customerId}`,
    );
  }
}

// ============================================================================
// INBOUND ADAPTER — HTTP controller (จำลอง req/res โดยไม่พึ่ง framework จริง
// เพื่อให้รันด้วย tsx ได้ตรง ๆ โดยไม่ต้องเปิด port; แนวคิดเดียวกับ Express/Fastify)
// ============================================================================

interface FakeHttpRequest {
  body: { customerId: string; sku: string; qty: number };
}
interface FakeHttpResponse {
  status: (code: number) => FakeHttpResponse;
  json: (payload: unknown) => void;
}

export class OrderHttpController {
  constructor(private readonly placeOrder: PlaceOrderUseCase) {}

  /** TH: นี่คือสิ่งที่ Express route handler จะเรียก — รู้จักแค่ use case ไม่รู้จัก core internals
   * EN: this is what an Express route handler would call — knows only the use case */
  async handlePost(req: FakeHttpRequest, res: FakeHttpResponse): Promise<void> {
    try {
      const order = await this.placeOrder.execute(req.body);
      res.status(201).json({ orderId: order.id, totalCents: order.totalCents });
    } catch (err) {
      if (err instanceof InsufficientStockError) {
        res.status(409).json({ error: err.message });
      } else {
        res.status(400).json({ error: (err as Error).message });
      }
    }
  }
}

function fakeResponse(): FakeHttpResponse {
  const res: FakeHttpResponse = {
    status(code: number) {
      console.log(` [HTTP] <- status ${code}`);
      return res;
    },
    json(payload: unknown) {
      console.log(` [HTTP] <- body`, payload);
    },
  };
  return res;
}

// ============================================================================
// DEMO — wiring: composition root ต่อ adapters เข้ากับ core (dependency injection)
// TH: จุดนี้คือที่เดียวที่รู้จักทั้ง "ของจริง" และ "core" — ทุกที่อื่นแยกกันสนิท
// ============================================================================

async function demo() {
  console.log('== Hexagonal Architecture: Place Order use case ==\n');

  // Composition root: เลือก adapter ที่จะใช้จริง (สลับเป็น Postgres/HTTP client ได้ที่นี่จุดเดียว)
  const placeOrder = new PlaceOrderService(
    new InMemoryProductLookup(),
    new InMemoryOrderRepository(),
    new ConsoleNotifier(),
  );
  const controller = new OrderHttpController(placeOrder);

  console.log('--- POST /orders { sku: SKU-001, qty: 2 } (should succeed) ---');
  await controller.handlePost(
    { body: { customerId: 'cust-1', sku: 'SKU-001', qty: 2 } },
    fakeResponse(),
  );

  console.log('\n--- POST /orders { sku: SKU-002, qty: 1 } (out of stock -> 409) ---');
  await controller.handlePost(
    { body: { customerId: 'cust-2', sku: 'SKU-002', qty: 1 } },
    fakeResponse(),
  );

  console.log(
    '\n--- Directly calling the use case without HTTP at all (e.g. from a CLI or test) ---',
  );
  const order = await placeOrder.execute({ customerId: 'cust-3', sku: 'SKU-001', qty: 1 });
  console.log(
    ` order placed without touching any HTTP code: ${order.id}, total=${order.totalCents} cents`,
  );
}

const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  demo();
}
