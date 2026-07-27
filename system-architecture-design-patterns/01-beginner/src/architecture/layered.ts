/**
 * Architecture Basics — Layered (N-Tier) Architecture
 * ================================================
 * เจตนา: จัดโครงสร้าง monolith ให้แยกเป็น "ชั้น" (layer) ที่มีหน้าที่ชัดเจน และมีทิศทาง
 * การเรียกใช้งานเป็นเส้นตรงในทิศทางเดียว (unidirectional):
 *
 *  Presentation -> Application -> Domain -> Infrastructure
 * (HTTP/CLI ui)  (use cases)  (business (DB, network,
 *          rules)  ภายนอกทั้งหมด)
 *
 * กฎเหล็ก: ชั้นบนเรียกชั้นล่างได้ แต่ชั้นล่าง "ห้าม" รู้จักชั้นบน
 * - Presentation : รับ input, แปลงเป็น DTO, ส่งต่อ Application, แปลงผลลัพธ์กลับเป็น response
 * - Application : ประสาน use case (orchestration) เรียก Domain + Infrastructure ตามลำดับ
 * - Domain  : business rules ล้วน ๆ ไม่ผูกกับ framework/DB ใด ๆ ทดสอบง่ายที่สุดในระบบ
 * - Infrastructure: รายละเอียดทาง technical (DB, external API) implement ตาม interface
 *     ที่ Domain/Application ต้องการ (สังเกตว่านี่คือ DIP ในทางปฏิบัติ)
 *
 * ตัวอย่างนี้จำลอง mini e-commerce: "สร้างออเดอร์" (Create Order) แบบง่าย ๆ
 * ที่ยังคง Separation of Concerns (SoC) ตามแนวคิด Layered Architecture
 */

// ===========================================================================
// 1) DOMAIN LAYER — business rules, entities, และ ports (interfaces) ที่ domain ต้องการ
// ===========================================================================
// Domain layer ไม่ import อะไรจาก Application/Infrastructure/Presentation เลย
// มันคือ "ใจกลาง" ของระบบที่ไม่ผูกกับเทคโนโลยีใด ๆ

namespace Domain {
  export interface OrderItem {
    readonly productId: string;
    readonly unitPrice: number;
    readonly quantity: number;
  }

  export class Order {
    private constructor(
      public readonly id: string,
      public readonly customerId: string,
      public readonly items: readonly OrderItem[],
      public readonly status: 'PENDING' | 'CONFIRMED' | 'REJECTED',
    ) {}

    /** Factory method ของ entity เอง — การันตี invariant ตั้งแต่สร้าง (ต้องมีสินค้าอย่างน้อย 1 รายการ) */
    static create(id: string, customerId: string, items: readonly OrderItem[]): Order {
      if (items.length === 0) {
        throw new DomainError('Order must contain at least one item');
      }
      return new Order(id, customerId, items, 'PENDING');
    }

    withStatus(status: Order['status']): Order {
      return new Order(this.id, this.customerId, this.items, status);
    }

    calculateTotal(): number {
      return this.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
    }
  }

  export class DomainError extends Error {}

  /**
   * Domain service: business rule ที่ไม่ได้ผูกกับ entity เดียว
   * (เช่น กฎ "ยอดสั่งซื้อขั้นต่ำ", "จำกัดจำนวนสินค้าต่อออเดอร์")
   */
  export class OrderPolicy {
    private static readonly MIN_ORDER_TOTAL = 100;

    assertMeetsMinimumOrderValue(order: Order): void {
      const total = order.calculateTotal();
      if (total < OrderPolicy.MIN_ORDER_TOTAL) {
        throw new DomainError(
          `Order total ${total} is below minimum order value of ${OrderPolicy.MIN_ORDER_TOTAL}`,
        );
      }
    }
  }

  /**
   * Port (interface) ที่ Domain/Application "ต้องการ" จาก Infrastructure
   * นี่คือจุดที่ Dependency Inversion Principle ถูกใช้จริงในระดับ architecture:
   * Domain กำหนดสัญญา ส่วน Infrastructure เป็นผู้ implement ตามสัญญานี้
   */
  export interface OrderRepositoryPort {
    save(order: Order): Promise<void>;
    findById(id: string): Promise<Order | undefined>;
  }

  export interface InventoryPort {
    reserveStock(productId: string, quantity: number): Promise<boolean>;
  }
}

// ===========================================================================
// 2) INFRASTRUCTURE LAYER — การ implement ports จริงในโลกภายนอก (DB, external services)
// ===========================================================================
// Infrastructure "รู้จัก" Domain (เพื่อ implement interface ของมัน) แต่ Domain ไม่รู้จัก
// Infrastructure กลับ — ทิศทางของ dependency ชี้เข้าสู่ Domain เสมอ

namespace Infrastructure {
  /** จำลอง repository ด้วย in-memory storage แทน MySQL/Postgres จริง เพื่อให้ demo รันได้ทันที */
  export class InMemoryOrderRepository implements Domain.OrderRepositoryPort {
    private readonly storage = new Map<string, Domain.Order>();

    async save(order: Domain.Order): Promise<void> {
      console.log(`[Infrastructure/DB] Persisting order ${order.id} (status=${order.status})`);
      this.storage.set(order.id, order);
    }

    async findById(id: string): Promise<Domain.Order | undefined> {
      return this.storage.get(id);
    }
  }

  /** จำลอง inventory service ภายนอก (เช่น เรียกผ่าน gRPC/REST ไปยังคลังสินค้า) */
  export class RemoteInventoryService implements Domain.InventoryPort {
    private readonly stockByProduct: Record<string, number> = {
      'SKU-1': 50,
      'SKU-2': 0,
      'SKU-3': 20,
    };

    async reserveStock(productId: string, quantity: number): Promise<boolean> {
      const available = this.stockByProduct[productId] ?? 0;
      console.log(
        `[Infrastructure/Inventory] Checking stock for ${productId}: available=${available}, requested=${quantity}`,
      );
      if (available < quantity) {
        return false;
      }
      this.stockByProduct[productId] = available - quantity;
      return true;
    }
  }
}

// ===========================================================================
// 3) APPLICATION LAYER — use case orchestration (ไม่มี business rule ในตัวมันเอง)
// ===========================================================================
// Application layer "ประสานงาน" ระหว่าง Domain กับ Infrastructure ตามลำดับขั้นตอนของ use case
// แต่ไม่ตัดสินใจ business rule เอง (มอบหน้าที่นั้นให้ Domain ทั้งหมด)

namespace Application {
  export interface CreateOrderRequest {
    readonly orderId: string;
    readonly customerId: string;
    readonly items: readonly Domain.OrderItem[];
  }

  export interface CreateOrderResult {
    readonly orderId: string;
    readonly status: string;
    readonly total: number;
  }

  export class CreateOrderUseCase {
    private readonly policy = new Domain.OrderPolicy();

    constructor(
      private readonly orderRepository: Domain.OrderRepositoryPort,
      private readonly inventory: Domain.InventoryPort,
    ) {}

    async execute(request: CreateOrderRequest): Promise<CreateOrderResult> {
      console.log(`[Application] Handling CreateOrder use case for customer ${request.customerId}`);

      // 1. สร้าง entity ผ่าน Domain factory (Domain ตรวจ invariant พื้นฐานให้เอง)
      let order = Domain.Order.create(request.orderId, request.customerId, request.items);

      // 2. ตรวจ business rule ผ่าน Domain policy (ไม่ใช่ตรวจเองใน Application layer)
      this.policy.assertMeetsMinimumOrderValue(order);

      // 3. จองสต็อกผ่าน Infrastructure port ทีละรายการ
      for (const item of order.items) {
        const reserved = await this.inventory.reserveStock(item.productId, item.quantity);
        if (!reserved) {
          order = order.withStatus('REJECTED');
          await this.orderRepository.save(order);
          return { orderId: order.id, status: order.status, total: order.calculateTotal() };
        }
      }

      // 4. ยืนยันออเดอร์และบันทึกผ่าน Infrastructure port
      order = order.withStatus('CONFIRMED');
      await this.orderRepository.save(order);

      return { orderId: order.id, status: order.status, total: order.calculateTotal() };
    }
  }
}

// ===========================================================================
// 4) PRESENTATION LAYER — จุดรับ input จากโลกภายนอก (จำลอง HTTP controller)
// ===========================================================================
// Presentation แปลง "raw request" (เช่น JSON body จาก HTTP) เป็น request object ของ
// Application layer แล้วแปลงผลลัพธ์กลับเป็น response — ไม่มี business logic ในชั้นนี้เลย

namespace Presentation {
  interface CreateOrderHttpBody {
    readonly customerId: string;
    readonly items: readonly { productId: string; unitPrice: number; quantity: number }[];
  }

  export class OrderController {
    constructor(private readonly createOrderUseCase: Application.CreateOrderUseCase) {}

    /** จำลอง HTTP handler: POST /orders */
    async handleCreateOrder(
      orderId: string,
      body: CreateOrderHttpBody,
    ): Promise<{ statusCode: number; body: unknown }> {
      console.log(`[Presentation] POST /orders received for customer=${body.customerId}`);

      try {
        const result = await this.createOrderUseCase.execute({
          orderId,
          customerId: body.customerId,
          items: body.items,
        });

        const statusCode = result.status === 'CONFIRMED' ? 201 : 409;
        return { statusCode, body: result };
      } catch (err) {
        if (err instanceof Domain.DomainError) {
          // Domain error -> แปลงเป็น 400 Bad Request ที่ presentation layer เท่านั้น
          return { statusCode: 400, body: { error: err.message } };
        }
        throw err;
      }
    }
  }
}

// ===========================================================================
// Composition root — จุดเดียวที่ "ประกอบ" ทุกชั้นเข้าด้วยกัน (wiring)
// ===========================================================================
// นี่คือที่เดียวในระบบที่รู้จักทั้ง 4 ชั้นพร้อมกัน ชั้นอื่น ๆ ไม่รู้จักกันเกินความจำเป็น

function bootstrapApplication(): Presentation.OrderController {
  const orderRepository = new Infrastructure.InMemoryOrderRepository();
  const inventory = new Infrastructure.RemoteInventoryService();
  const createOrderUseCase = new Application.CreateOrderUseCase(orderRepository, inventory);
  return new Presentation.OrderController(createOrderUseCase);
}

// ===========================================================================
// Demo
// ===========================================================================

async function runDemo(): Promise<void> {
  const controller = bootstrapApplication();

  console.log('--- Request flow #1: successful order (สต็อกพอ, ยอดถึงขั้นต่ำ) ---');
  const success = await controller.handleCreateOrder('ORD-1', {
    customerId: 'CUST-001',
    items: [{ productId: 'SKU-1', unitPrice: 300, quantity: 2 }],
  });
  console.log('Response:', success);

  console.log('\n--- Request flow #2: rejected order (สต็อกไม่พอ, SKU-2 = 0) ---');
  const outOfStock = await controller.handleCreateOrder('ORD-2', {
    customerId: 'CUST-002',
    items: [{ productId: 'SKU-2', unitPrice: 500, quantity: 1 }],
  });
  console.log('Response:', outOfStock);

  console.log('\n--- Request flow #3: domain validation error (ยอดต่ำกว่าขั้นต่ำ 100) ---');
  const belowMinimum = await controller.handleCreateOrder('ORD-3', {
    customerId: 'CUST-003',
    items: [{ productId: 'SKU-3', unitPrice: 50, quantity: 1 }],
  });
  console.log('Response:', belowMinimum);

  console.log(
    '\nสังเกตทิศทาง dependency: Presentation -> Application -> Domain <- Infrastructure\n' +
      'Domain ไม่ import อะไรจาก Infrastructure/Application/Presentation เลย — ' +
      "มันแค่ประกาศ 'port' (interface) ที่ตัวเองต้องการ แล้วให้ Infrastructure เป็นฝ่าย " +
      'มา implement ตามสัญญานั้น (Dependency Inversion ใช้จริงในระดับสถาปัตยกรรม)',
  );
}

const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  runDemo();
}

export { Domain, Infrastructure, Application, Presentation, bootstrapApplication };
