# LAB — Intermediate: Structural, Behavioral & Architectural Patterns

3 lab แนว System Design Interview พร้อมเฉลยครบ — ทำให้ครบก่อนดูเฉลย จำกัดเวลา 45–90 นาทีต่อข้อ

---

## สารบัญ

1. [Lab 1 — Legacy Payment Integration](#lab-1--legacy-payment-integration)
2. [Lab 2 — Refactor Switch Hell](#lab-2--refactor-switch-hell)
3. [Lab 3 — Hexagonal Catalog Service](#lab-3--hexagonal-catalog-service)

---

## Lab 1 — Legacy Payment Integration

### โจทย์

บริษัท **ShopNow** มีระบบ checkout เดียว แต่ต้องรับเงินผ่าน **3 payment vendor ที่ interface เข้ากันไม่ได้**:

1. **`LegacyBankGateway`** — ระบบธนาคารเก่าที่ทีม infra เขียนไว้ 10 ปีก่อน ใช้ synchronous method, error แทนด้วย response code string (`"00"` = success), หน่วยเงินเป็นบาท (float), **รับเฉพาะ THB**
2. **`GlobalCardSdk`** — SDK บัตรเครดิตสากล (คล้าย Stripe) เป็น async/Promise, หน่วยเงินเป็น cents, error สื่อผ่าน field `status`, รองรับหลายสกุลเงิน แต่ **ค่าธรรมเนียมสูงกว่าธนาคารในประเทศ**
3. **`RegionalWalletApi`** — e-wallet ระดับภูมิภาค ใช้ callback-style (ไม่มี Promise), รับเฉพาะ **THB/MYR/SGD**, และ **มี rate-limit เข้มงวด** (ถ้าใช้ถี่เกินจะถูก throttle)

ทีม product ต้องการ checkout เดียวที่:

- เลือก vendor อัตโนมัติตาม currency + preferred method ของลูกค้า
- ถ้า vendor หลักล่ม (throw/timeout) ให้ **fallback ไปอีก vendor** โดยอัตโนมัติ (ถ้าทำได้ตาม currency)
- orchestrate เต็ม flow: ตรวจสต็อก → จองสต็อก → เก็บเงิน (พร้อม fallback) → จัดส่ง → แจ้งเตือน
- **rollback สต็อกที่จองไว้** ถ้าสุดท้ายเก็บเงินไม่สำเร็จเลยแม้ fallback แล้ว

### ข้อจำกัด

- **ห้ามแก้โค้ดของ 3 vendor เลยแม้แต่บรรทัดเดียว** (สมมติว่าเป็น 3rd-party package หรือทีมอื่นดูแล)
- Business logic (checkout flow) **ห้าม** import type/class ของ vendor ใด ๆ ตรง ๆ
- ต้องเขียน unit test ได้โดยไม่ต้องมี vendor จริง (mock ผ่าน interface เดียว)

### วิธีคิด

1. **นิยาม `PaymentPort`** — interface กลางที่ checkout flow จะเรียก ไม่สนใจว่าหลังบ้านเป็น vendor ไหน
2. **เขียน Adapter 3 ตัว** — แต่ละตัวแปล vendor-specific call ให้เป็น `PaymentPort` รวมถึง "แปลง error/currency/async style" ให้เป็นมาตรฐานเดียวกัน — งานสกปรกทั้งหมด (promisify callback, แปลงหน่วยเงิน, แปลง error code) อยู่ใน Adapter เท่านั้น ไม่รั่วออกไปที่อื่น
3. **`VendorRouter`** — เลือก adapter ตัวแรก (primary) ตาม currency + preferred method แล้วมี fallback list ตาม currency ที่รองรับ
4. **`OrderCheckoutFacade`** — orchestrate flow เดิม (inventory → payment → shipping → notify) โดยเรียก `VendorRouter` แทนที่จะเรียก vendor ตรง ๆ, ทำ compensation (release stock) ถ้าเก็บเงินไม่ผ่านทุก vendor

### โครงสร้าง

```
CheckoutFacade
 └─▶ InventoryService (reserve/release)
 └─▶ VendorRouter
  ├─▶ PaymentPort (interface)
  │  ├─ LegacyBankAdapter → LegacyBankGateway (ห้ามแก้)
  │  ├─ GlobalCardAdapter → GlobalCardSdk (ห้ามแก้)
  │  └─ RegionalWalletAdapter→ RegionalWalletApi (ห้ามแก้)
  └─▶ fallback order ตาม currency
 └─▶ ShippingService
 └─▶ NotificationService
```

### โค้ดเฉลย

```typescript
// ---------- 1) PORT ----------
interface ChargeRequest {
  amountCents: number;
  currency: 'THB' | 'USD' | 'MYR' | 'SGD';
  customerRef: string;
}
interface ChargeResult {
  success: boolean;
  vendorName: string;
  providerTransactionId?: string;
  errorReason?: string;
}
interface PaymentPort {
  readonly vendorName: string;
  readonly supportedCurrencies: ReadonlySet<string>;
  charge(request: ChargeRequest): Promise<ChargeResult>;
}

// ---------- 2) VENDOR SDKS (ห้ามแก้ — จำลองไว้ให้ครบตามโจทย์) ----------
class LegacyBankGateway {
  submitPaymentXml(
    amountBaht: number,
    accountId: string,
  ): { STATUS_CODE: '00' | '99'; REF_NO: string } {
    if (accountId.endsWith('x')) return { STATUS_CODE: '99', REF_NO: '' }; // จำลอง decline
    return { STATUS_CODE: '00', REF_NO: `BANK-${Date.now()}` };
  }
}

class GlobalCardSdk {
  async createCharge(opts: {
    amount: number;
    currency: string;
  }): Promise<{ id: string; status: 'succeeded' | 'failed' }> {
    await new Promise((r) => setTimeout(r, 5));
    return { id: `pi_${Math.random().toString(36).slice(2)}`, status: 'succeeded' };
  }
}

class RegionalWalletApi {
  private callsThisMinute = 0;
  pay(satang: number, cb: (err: Error | null, result?: { txId: string }) => void): void {
    this.callsThisMinute += 1;
    if (this.callsThisMinute > 3) return cb(new Error('rate limit exceeded'));
    setTimeout(() => cb(null, { txId: `WALLET-${Date.now()}` }), 0);
  }
}

// ---------- 3) ADAPTERS ----------
class LegacyBankAdapter implements PaymentPort {
  readonly vendorName = 'LegacyBank';
  readonly supportedCurrencies = new Set(['THB']);
  constructor(private readonly gateway: LegacyBankGateway) {}

  async charge(request: ChargeRequest): Promise<ChargeResult> {
    const res = this.gateway.submitPaymentXml(request.amountCents / 100, request.customerRef);
    return res.STATUS_CODE === '00'
      ? { success: true, vendorName: this.vendorName, providerTransactionId: res.REF_NO }
      : { success: false, vendorName: this.vendorName, errorReason: 'bank declined' };
  }
}

class GlobalCardAdapter implements PaymentPort {
  readonly vendorName = 'GlobalCard';
  readonly supportedCurrencies = new Set(['THB', 'USD', 'MYR', 'SGD']);
  constructor(private readonly sdk: GlobalCardSdk) {}

  async charge(request: ChargeRequest): Promise<ChargeResult> {
    const res = await this.sdk.createCharge({
      amount: request.amountCents,
      currency: request.currency,
    });
    return res.status === 'succeeded'
      ? { success: true, vendorName: this.vendorName, providerTransactionId: res.id }
      : { success: false, vendorName: this.vendorName, errorReason: 'card failed' };
  }
}

class RegionalWalletAdapter implements PaymentPort {
  readonly vendorName = 'RegionalWallet';
  readonly supportedCurrencies = new Set(['THB', 'MYR', 'SGD']);
  constructor(private readonly wallet: RegionalWalletApi) {}

  charge(request: ChargeRequest): Promise<ChargeResult> {
    return new Promise((resolve) => {
      this.wallet.pay(request.amountCents, (err, result) => {
        if (err || !result)
          return resolve({
            success: false,
            vendorName: this.vendorName,
            errorReason: err?.message,
          });
        resolve({ success: true, vendorName: this.vendorName, providerTransactionId: result.txId });
      });
    });
  }
}

// ---------- 4) VENDOR ROUTER — เลือก primary + fallback ตาม currency ----------
class VendorRouter {
  constructor(private readonly vendors: PaymentPort[]) {}

  private candidatesFor(currency: string): PaymentPort[] {
    // TH: ธนาคารในประเทศถูกกว่า ลองก่อนเสมอถ้ารองรับ currency นั้น แล้วค่อย fallback ไป wallet, สุดท้ายค่อย card (ค่าธรรมเนียมสูงสุด)
    const priority = [LegacyBankAdapter, RegionalWalletAdapter, GlobalCardAdapter];
    return this.vendors
      .filter((v) => v.supportedCurrencies.has(currency))
      .sort(
        (a, b) =>
          priority.findIndex((p) => a instanceof p) - priority.findIndex((p) => b instanceof p),
      );
  }

  async chargeWithFallback(request: ChargeRequest): Promise<ChargeResult> {
    const candidates = this.candidatesFor(request.currency);
    if (candidates.length === 0) {
      return {
        success: false,
        vendorName: 'none',
        errorReason: `no vendor supports ${request.currency}`,
      };
    }

    let lastResult: ChargeResult | null = null;
    for (const vendor of candidates) {
      console.log(` [VendorRouter] trying ${vendor.vendorName} for ${request.currency}...`);
      try {
        const result = await vendor.charge(request);
        if (result.success) return result;
        lastResult = result;
        console.log(
          ` [VendorRouter] ${vendor.vendorName} failed: ${result.errorReason} — trying next vendor`,
        );
      } catch (err) {
        lastResult = {
          success: false,
          vendorName: vendor.vendorName,
          errorReason: (err as Error).message,
        };
        console.log(
          ` [VendorRouter] ${vendor.vendorName} threw: ${(err as Error).message} — trying next vendor`,
        );
      }
    }
    return lastResult!;
  }
}

// ---------- 5) FACADE — orchestration + compensation ----------
class InventoryService {
  private stock = new Map([['SKU-1', 5]]);
  reserve(sku: string, qty: number): boolean {
    const cur = this.stock.get(sku) ?? 0;
    if (cur < qty) return false;
    this.stock.set(sku, cur - qty);
    return true;
  }
  release(sku: string, qty: number): void {
    this.stock.set(sku, (this.stock.get(sku) ?? 0) + qty);
  }
}

class OrderCheckoutFacade {
  constructor(
    private readonly inventory: InventoryService,
    private readonly router: VendorRouter,
  ) {}

  async checkout(
    sku: string,
    qty: number,
    amountCents: number,
    currency: ChargeRequest['currency'],
    customerRef: string,
  ) {
    if (!this.inventory.reserve(sku, qty)) {
      return { status: 'out_of_stock' as const };
    }

    const result = await this.router.chargeWithFallback({ amountCents, currency, customerRef });
    if (!result.success) {
      this.inventory.release(sku, qty); // compensation
      return { status: 'payment_failed' as const, reason: result.errorReason };
    }

    console.log(` [Shipping] shipment scheduled for ${customerRef}`);
    console.log(` [Notification] confirmation sent to ${customerRef}`);
    return {
      status: 'success' as const,
      vendor: result.vendorName,
      txId: result.providerTransactionId,
    };
  }
}

// ---------- DEMO ----------
async function demo() {
  const router = new VendorRouter([
    new LegacyBankAdapter(new LegacyBankGateway()),
    new GlobalCardAdapter(new GlobalCardSdk()),
    new RegionalWalletAdapter(new RegionalWalletApi()),
  ]);
  const facade = new OrderCheckoutFacade(new InventoryService(), router);

  console.log(await facade.checkout('SKU-1', 1, 50000, 'THB', 'cust-ok'));
  console.log(await facade.checkout('SKU-1', 1, 50000, 'THB', 'cust-fail-x')); // bank declined -> fallback wallet
  console.log(await facade.checkout('SKU-1', 10, 50000, 'THB', 'cust-oos')); // out of stock
}

demo();
```

**สิ่งที่ทำให้เฉลยนี้ "senior-level":**

- Adapter รับผิดชอบ "แปลง error/async style" ทั้งหมด ไม่มี business logic รู้จัก error code ของ vendor เลย
- `VendorRouter` แยกออกจาก `Facade` — router คือ Strategy-selection logic, facade คือ orchestration ล้วน ๆ (Single Responsibility)
- Fallback ทำงานได้แม้ vendor throw exception จริง (ไม่ใช่แค่ return `success:false`)
- Compensation (release stock) เกิดเฉพาะเมื่อ **ทุก vendor ที่เป็นไปได้ล้มเหลวแล้ว** ไม่ release ก่อนเวลา

### คำถาม Interview

1. ถ้าต้องเพิ่ม vendor ตัวที่ 4 พรุ่งนี้เช้า จะแก้ไฟล์กี่ไฟล์ และทำไม design นี้ทำให้แก้น้อย?
2. ทำไม fallback logic ต้องอยู่ใน `VendorRouter` ไม่อยู่ใน `Facade` หรือใน adapter ของ vendor ตัวเอง?
3. ถ้า vendor "สำเร็จ" แต่ network timeout ตอนรับ response (เงินถูกตัดจริงแต่เราไม่รู้ผล) จะออกแบบยังไงให้ไม่ charge ซ้ำตอน retry/fallback? (คำตอบที่คาดหวัง: idempotency key ส่งไปที่ vendor ทุกครั้งที่ retry)
4. อธิบาย trade-off ของการ "compensate ทีหลัง" (release stock ถ้า payment fail) เทียบกับการใช้ 2-phase commit หรือ distributed transaction

---

## Lab 2 — Refactor Switch Hell

### โจทย์

ทีมสืบทอดโค้ด `LegacyOrderProcessor` มา — ทำทุกอย่างในไฟล์เดียวด้วย giant `switch` 3 อัน: คิดค่าส่ง, จัดการ transition ของสถานะออเดอร์, และ execute operation ต่าง ๆ (พร้อม "undo" ที่ทำผ่าน flag แปลก ๆ) ทุกครั้งที่มี requirement ใหม่ ทีมต้องแก้ทั้ง 3 switch พร้อมกันและมักลืมเคสใดเคสหนึ่งเสมอ

**โค้ดเดิม (Before):**

```typescript
type ShippingMethod = 'flat' | 'weight' | 'distance';
type OrderStatus = 'pending' | 'paid' | 'shipped' | 'delivered' | 'cancelled';
type OperationType = 'insert_note' | 'apply_discount';

class LegacyOrderProcessor {
  calculateShipping(method: ShippingMethod, weightKg: number, distanceKm: number): number {
    switch (method) {
      case 'flat':
        return 5000;
      case 'weight':
        return 2000 + Math.ceil(weightKg) * 1500;
      case 'distance':
        return 3000 + Math.ceil(distanceKm) * 50;
      default:
        throw new Error('unknown shipping method');
    }
  }

  transitionStatus(current: OrderStatus, action: string): OrderStatus {
    // TH: บั๊กจริงที่เจอในระบบนี้ — ไม่เช็คว่า current state อนุญาต action นี้ไหมเลย!
    switch (action) {
      case 'pay':
        return 'paid';
      case 'ship':
        return 'shipped';
      case 'deliver':
        return 'delivered';
      case 'cancel':
        return 'cancelled';
      default:
        return current;
    }
    // ผลคือ: transitionStatus("delivered", "cancel") -> "cancelled" ได้ ทั้งที่ของถึงมือลูกค้าแล้ว!
  }

  private undoLog: Array<{ type: OperationType; payload: any; previous: any }> = [];

  executeOperation(
    order: { notes: string[]; totalCents: number },
    type: OperationType,
    payload: any,
  ): void {
    switch (type) {
      case 'insert_note':
        this.undoLog.push({ type, payload, previous: null });
        order.notes.push(payload.text);
        break;
      case 'apply_discount':
        this.undoLog.push({ type, payload, previous: order.totalCents });
        order.totalCents = Math.round(order.totalCents * (1 - payload.percent / 100));
        break;
    }
  }

  undoLastOperation(order: { notes: string[]; totalCents: number }): void {
    const last = this.undoLog.pop();
    if (!last) return;
    // TH: undo ของ insert_note "ทำไม่ได้จริง" เพราะไม่รู้ index ที่แทรก — บั๊กซ่อนอยู่
    if (last.type === 'apply_discount') order.totalCents = last.previous;
  }
}
```

### ข้อจำกัด

- ห้ามเปลี่ยน public behavior ที่ "ถูกต้อง" อยู่แล้ว (เช่น flat shipping = 5000 cents ต้องเท่าเดิม)
- ต้องแก้บั๊ก 2 อันที่พบ: (1) `transitionStatus` ไม่เช็ค legal transition, (2) `undoLastOperation` undo `insert_note` ไม่ได้จริง
- โค้ดใหม่ต้องเพิ่ม shipping method / order action / operation type ใหม่ได้โดย **ไม่แก้ switch เดิม** (เพราะจะไม่มี switch เดิมให้แก้แล้ว)

### วิธีคิด

| Switch เดิม                              | ปัญหา                                                                      | Pattern ที่แทนที่ |
| ---------------------------------------- | -------------------------------------------------------------------------- | ----------------- |
| `calculateShipping`                      | เพิ่มวิธีคิดค่าส่งใหม่ต้องแก้ switch, ทดสอบยากเพราะรวมกันใน function เดียว | **Strategy**      |
| `transitionStatus`                       | ไม่มีการตรวจสอบว่า transition ถูกกฎ, logic กระจายอยู่ใน string comparison  | **State**         |
| `executeOperation` + `undoLastOperation` | undo ไม่สมบูรณ์ (ไม่เก็บ state ที่พอสำหรับ undo แต่ละชนิด)                 | **Command**       |

### โครงสร้าง

```
ShippingCalculator(strategy: ShippingStrategy)
 ├─ FlatRateStrategy / WeightBasedStrategy / DistanceBasedStrategy

OrderStatusContext(state: OrderState)
 ├─ PendingState / PaidState / ShippedState / DeliveredState / CancelledState

OrderOperationHistory
 ├─ InsertNoteCommand (execute/undo เก็บ index ที่แทรกจริง)
 └─ ApplyDiscountCommand (execute/undo เก็บ totalCents เดิม)
```

### โค้ดเฉลย (After)

```typescript
// ---------- STRATEGY: แทน calculateShipping switch ----------
interface ShippingStrategy {
  calculate(weightKg: number, distanceKm: number): number;
}
class FlatRateStrategy implements ShippingStrategy {
  calculate(): number {
    return 5000;
  }
}
class WeightBasedStrategy implements ShippingStrategy {
  calculate(weightKg: number): number {
    return 2000 + Math.ceil(weightKg) * 1500;
  }
}
class DistanceBasedStrategy implements ShippingStrategy {
  calculate(_weightKg: number, distanceKm: number): number {
    return 3000 + Math.ceil(distanceKm) * 50;
  }
}
// เพิ่มวิธีใหม่ = เพิ่ม class ใหม่ตรงนี้ ไม่ต้องแก้ที่อื่นเลย เช่น:
class ExpressSurchargeStrategy implements ShippingStrategy {
  constructor(private readonly base: ShippingStrategy) {}
  calculate(weightKg: number, distanceKm: number): number {
    return this.base.calculate(weightKg, distanceKm) + 10000;
  }
}

class ShippingCalculator {
  constructor(private strategy: ShippingStrategy) {}
  setStrategy(strategy: ShippingStrategy) {
    this.strategy = strategy;
  }
  quote(weightKg: number, distanceKm: number): number {
    return this.strategy.calculate(weightKg, distanceKm);
  }
}

// ---------- STATE: แทน transitionStatus switch ----------
interface OrderState {
  readonly name: string;
  pay(ctx: OrderStatusContext): void;
  ship(ctx: OrderStatusContext): void;
  deliver(ctx: OrderStatusContext): void;
  cancel(ctx: OrderStatusContext): void;
}
abstract class BaseState implements OrderState {
  abstract readonly name: string;
  pay(ctx: OrderStatusContext) {
    this.reject(ctx, 'pay');
  }
  ship(ctx: OrderStatusContext) {
    this.reject(ctx, 'ship');
  }
  deliver(ctx: OrderStatusContext) {
    this.reject(ctx, 'deliver');
  }
  cancel(ctx: OrderStatusContext) {
    this.reject(ctx, 'cancel');
  }
  protected reject(ctx: OrderStatusContext, action: string) {
    throw new Error(`Cannot ${action} an order in state "${this.name}"`); // แก้บั๊ก #1: ปฏิเสธ transition ที่ผิดกฎ
  }
}
class PendingState extends BaseState {
  readonly name = 'pending';
  override pay(ctx: OrderStatusContext) {
    ctx.transitionTo(new PaidState());
  }
  override cancel(ctx: OrderStatusContext) {
    ctx.transitionTo(new CancelledState());
  }
}
class PaidState extends BaseState {
  readonly name = 'paid';
  override ship(ctx: OrderStatusContext) {
    ctx.transitionTo(new ShippedState());
  }
  override cancel(ctx: OrderStatusContext) {
    ctx.transitionTo(new CancelledState());
  }
}
class ShippedState extends BaseState {
  readonly name = 'shipped';
  override deliver(ctx: OrderStatusContext) {
    ctx.transitionTo(new DeliveredState());
  }
  // ไม่ override cancel() -> ปฏิเสธเสมอ เหมือนใน src/behavioral/state/state.ts
}
class DeliveredState extends BaseState {
  readonly name = 'delivered'; // terminal — ไม่ override อะไร -> cancel() ถูกปฏิเสธเสมอ (แก้บั๊ก #1 โดยตรง)
}
class CancelledState extends BaseState {
  readonly name = 'cancelled';
}

class OrderStatusContext {
  private state: OrderState = new PendingState();
  get status() {
    return this.state.name;
  }
  transitionTo(state: OrderState) {
    this.state = state;
  }
  pay() {
    this.state.pay(this);
  }
  ship() {
    this.state.ship(this);
  }
  deliver() {
    this.state.deliver(this);
  }
  cancel() {
    this.state.cancel(this);
  }
}

// ---------- COMMAND: แทน executeOperation + undoLastOperation ----------
interface Order {
  notes: string[];
  totalCents: number;
}
interface Command {
  execute(): void;
  undo(): void;
}
class InsertNoteCommand implements Command {
  private insertedIndex = -1;
  constructor(
    private readonly order: Order,
    private readonly text: string,
  ) {}
  execute() {
    this.order.notes.push(this.text);
    this.insertedIndex = this.order.notes.length - 1; // แก้บั๊ก #2: เก็บ index จริงไว้ undo ได้
  }
  undo() {
    if (this.insertedIndex >= 0) this.order.notes.splice(this.insertedIndex, 1);
  }
}
class ApplyDiscountCommand implements Command {
  private previousTotal = 0;
  constructor(
    private readonly order: Order,
    private readonly percent: number,
  ) {}
  execute() {
    this.previousTotal = this.order.totalCents;
    this.order.totalCents = Math.round(this.order.totalCents * (1 - this.percent / 100));
  }
  undo() {
    this.order.totalCents = this.previousTotal;
  }
}

class OrderOperationHistory {
  private readonly stack: Command[] = [];
  execute(command: Command) {
    command.execute();
    this.stack.push(command);
  }
  undoLast(): boolean {
    const command = this.stack.pop();
    if (!command) return false;
    command.undo();
    return true;
  }
}

// ---------- DEMO: พิสูจน์ว่าบั๊กเดิม 2 อันถูกแก้แล้ว ----------
function demo() {
  // บั๊ก #1 เดิม: delivered -> cancel สำเร็จ (ผิด). ตอนนี้ต้องถูกปฏิเสธ
  const ctx = new OrderStatusContext();
  ctx.pay();
  ctx.ship();
  ctx.deliver();
  try {
    ctx.cancel();
    console.log('BUG STILL EXISTS');
  } catch (err) {
    console.log('Fixed bug #1:', (err as Error).message);
  }

  // บั๊ก #2 เดิม: undo ของ insert_note ไม่คืนค่าจริง ตอนนี้ต้องคืนได้
  const order: Order = { notes: [], totalCents: 10000 };
  const history = new OrderOperationHistory();
  history.execute(new InsertNoteCommand(order, 'gift wrap please'));
  console.log('notes after insert:', order.notes);
  history.undoLast();
  console.log('notes after undo (should be empty):', order.notes);

  // ยืนยันว่า shipping คำนวณเหมือนเดิม (ไม่ทำลาย public behavior)
  const calc = new ShippingCalculator(new FlatRateStrategy());
  console.log('flat shipping (should be 5000):', calc.quote(0, 0));
}

demo();
```

### คำถาม Interview

1. ทำไม `transitionStatus` แบบเดิมถึงเป็นบั๊กที่ "อันตราย" ในระบบจริง ไม่ใช่แค่ edge case เล็ก ๆ?
2. ถ้า PM บอกว่าต้องรองรับ shipping method ใหม่ "SubscriptionFreeShipping" ที่ฟรีเสมอสำหรับสมาชิก VIP จะเพิ่มโดยไม่แก้ไฟล์เดิมได้อย่างไร? (คำตอบที่คาดหวัง: Decorator/Strategy ใหม่ที่ wrap strategy เดิม เหมือน `ExpressSurchargeStrategy`)
3. เพราะเหตุใด `InsertNoteCommand` ต้องเก็บ `insertedIndex` แทนที่จะ `pop()` ตอน undo เฉย ๆ? (คำตอบที่คาดหวัง: ถ้ามี insert หลายจุดสลับกับ operation อื่น การ `pop()` ธรรมดาอาจลบตัวที่ไม่ใช่ตัวที่ต้องการถ้าลำดับ undo ไม่ตรงกับลำดับ insert เป๊ะ — การเก็บ index ทำให้ robust กว่า)
4. Strategy, State, Command ทั้ง 3 อันมีจุดร่วมเดียวกันคือ "แทนที่ conditional logic ด้วย polymorphism" — อธิบายว่าทำไมการใช้ pattern ทั้ง 3 พร้อมกันในไฟล์เดียวไม่ทำให้ระบบซับซ้อนเกินจำเป็น (คำตอบที่คาดหวัง: เพราะแต่ละ pattern แก้ปัญหาคนละมิติที่ "ไม่เกี่ยวกัน" — ราคา, สถานะ, ประวัติการกระทำ — การรวมกันใน domain เดียวไม่ได้แปลว่า coupling กัน)

---

## Lab 3 — Hexagonal Catalog Service

### โจทย์

ออกแบบ **Product Catalog Service** ด้วย Hexagonal Architecture (Ports & Adapters) ที่ต้อง:

- ค้นหาสินค้า (`searchProducts`) ตามคำค้นและ filter หมวดหมู่
- ดูรายละเอียดสินค้าเดี่ยว (`getProduct`)
- update สต็อก (`updateStock`) — ต้อง validate ว่าไม่ติดลบ
- รองรับให้เรียกได้จากทั้ง **HTTP API** และ **Admin CLI** (สอง transport พร้อมกัน) โดย business logic เขียนครั้งเดียว
- ต้อง **เขียน automated test ได้โดยไม่ต้องมี database จริง**

พร้อมอธิบายเทียบกับ **MVC** สั้น ๆ ว่าทำไมเลือก Hexagonal สำหรับ service นี้

### ข้อจำกัด

- ห้ามให้ use case (core) รู้จัก `Request`/`Response` ของ HTTP framework หรือ SQL syntax เลย
- ทั้ง HTTP adapter และ CLI adapter ต้องเรียก use case เดียวกัน (ไม่ duplicate logic)
- ต้อง demo ได้ว่าสลับจาก `InMemoryProductRepository` ไป repository อื่นทำได้โดยไม่แก้ core

### วิธีคิด

1. กำหนด **Entity**: `Product { id, name, category, priceCents, stock }`
2. กำหนด **Inbound Ports** (use cases): `SearchProductsUseCase`, `GetProductUseCase`, `UpdateStockUseCase`
3. กำหนด **Outbound Port**: `ProductRepositoryPort` (find, search, save) — core กำหนด interface เอง
4. เขียน **Core Services** implement inbound ports โดยพึ่งพาแค่ outbound port
5. เขียน **Inbound Adapters**: `HttpProductController`, `AdminCli` — ทั้งสองเรียก use case เดียวกัน
6. เขียน **Outbound Adapter**: `InMemoryProductRepository` (สำหรับ dev/test) — โครงสร้างเดียวกันถ้าจะเปลี่ยนเป็น Postgres คือเขียน `PostgresProductRepository implements ProductRepositoryPort` แล้วสลับที่ composition root

### โครงสร้างไฟล์ (ถ้าแยกเป็น project จริง)

```
catalog-service/
├── src/
│ ├── domain/
│ │ └── product.ts      ← Entity + invariants
│ ├── ports/
│ │ ├── inbound/
│ │ │ ├── search-products.port.ts
│ │ │ ├── get-product.port.ts
│ │ │ └── update-stock.port.ts
│ │ └── outbound/
│ │  └── product-repository.port.ts
│ ├── core/
│ │ ├── search-products.service.ts  ← implements SearchProductsUseCase
│ │ ├── get-product.service.ts
│ │ └── update-stock.service.ts
│ ├── adapters/
│ │ ├── inbound/
│ │ │ ├── http/product.controller.ts
│ │ │ └── cli/admin-cli.ts
│ │ └── outbound/
│ │  ├── in-memory-product.repository.ts ← dev/test
│ │  └── postgres-product.repository.ts ← production (ไม่ implement ในแล็บนี้)
│ └── composition-root.ts    ← wiring ทั้งหมด
└── test/
 └── update-stock.service.test.ts  ← ใช้ InMemoryProductRepository, ไม่แตะ DB จริง
```

### โค้ดเฉลย

```typescript
// ---------- DOMAIN ----------
interface Product {
  id: string;
  name: string;
  category: string;
  priceCents: number;
  stock: number;
}
class InsufficientStockError extends Error {
  constructor(id: string) {
    super(`Cannot reduce stock below zero for product ${id}`);
  }
}
class ProductNotFoundError extends Error {
  constructor(id: string) {
    super(`Product ${id} not found`);
  }
}

// ---------- OUTBOUND PORT (core กำหนดเอง) ----------
interface ProductRepositoryPort {
  findById(id: string): Promise<Product | null>;
  search(query: string, category?: string): Promise<Product[]>;
  save(product: Product): Promise<void>;
}

// ---------- INBOUND PORTS ----------
interface SearchProductsUseCase {
  execute(query: string, category?: string): Promise<Product[]>;
}
interface GetProductUseCase {
  execute(id: string): Promise<Product>;
}
interface UpdateStockUseCase {
  execute(id: string, delta: number): Promise<Product>;
}

// ---------- CORE SERVICES ----------
class SearchProductsService implements SearchProductsUseCase {
  constructor(private readonly repo: ProductRepositoryPort) {}
  execute(query: string, category?: string): Promise<Product[]> {
    return this.repo.search(query, category);
  }
}
class GetProductService implements GetProductUseCase {
  constructor(private readonly repo: ProductRepositoryPort) {}
  async execute(id: string): Promise<Product> {
    const product = await this.repo.findById(id);
    if (!product) throw new ProductNotFoundError(id);
    return product;
  }
}
class UpdateStockService implements UpdateStockUseCase {
  constructor(private readonly repo: ProductRepositoryPort) {}
  async execute(id: string, delta: number): Promise<Product> {
    const product = await this.repo.findById(id);
    if (!product) throw new ProductNotFoundError(id);
    const newStock = product.stock + delta;
    if (newStock < 0) throw new InsufficientStockError(id);
    const updated = { ...product, stock: newStock };
    await this.repo.save(updated);
    return updated;
  }
}

// ---------- OUTBOUND ADAPTER (dev/test) ----------
class InMemoryProductRepository implements ProductRepositoryPort {
  private readonly store = new Map<string, Product>();
  constructor(seed: Product[] = []) {
    for (const p of seed) this.store.set(p.id, p);
  }
  async findById(id: string): Promise<Product | null> {
    return this.store.get(id) ?? null;
  }
  async search(query: string, category?: string): Promise<Product[]> {
    return [...this.store.values()].filter(
      (p) =>
        p.name.toLowerCase().includes(query.toLowerCase()) &&
        (!category || p.category === category),
    );
  }
  async save(product: Product): Promise<void> {
    this.store.set(product.id, product);
  }
}

// ---------- INBOUND ADAPTER: HTTP (จำลอง req/res) ----------
class ProductHttpController {
  constructor(
    private readonly search: SearchProductsUseCase,
    private readonly get: GetProductUseCase,
    private readonly updateStock: UpdateStockUseCase,
  ) {}

  async handleSearch(query: string, category?: string) {
    return { status: 200, body: await this.search.execute(query, category) };
  }
  async handleGet(id: string) {
    try {
      return { status: 200, body: await this.get.execute(id) };
    } catch (err) {
      return { status: 404, body: { error: (err as Error).message } };
    }
  }
  async handleUpdateStock(id: string, delta: number) {
    try {
      return { status: 200, body: await this.updateStock.execute(id, delta) };
    } catch (err) {
      const status = err instanceof InsufficientStockError ? 409 : 404;
      return { status, body: { error: (err as Error).message } };
    }
  }
}

// ---------- INBOUND ADAPTER: Admin CLI (ใช้ use case เดียวกันเป๊ะ ไม่มี logic ซ้ำ) ----------
class AdminCli {
  constructor(private readonly updateStock: UpdateStockUseCase) {}
  async run(command: string, id: string, delta: number) {
    if (command !== 'restock') throw new Error('unknown command');
    const product = await this.updateStock.execute(id, delta);
    console.log(`[CLI] stock updated: ${product.name} -> ${product.stock}`);
  }
}

// ---------- COMPOSITION ROOT ----------
async function demo() {
  const repo = new InMemoryProductRepository([
    { id: 'p1', name: 'Keyboard', category: 'peripherals', priceCents: 259900, stock: 10 },
  ]);
  const search = new SearchProductsService(repo);
  const get = new GetProductService(repo);
  const updateStock = new UpdateStockService(repo);

  const http = new ProductHttpController(search, get, updateStock);
  const cli = new AdminCli(updateStock);

  console.log(await http.handleSearch('key'));
  console.log(await http.handleUpdateStock('p1', -3)); // ผ่าน HTTP
  await cli.run('restock', 'p1', 5); // ผ่าน CLI — เรียก use case เดียวกัน ผลลัพธ์สอดคล้องกัน
  console.log(await http.handleGet('p1'));
  console.log(await http.handleUpdateStock('p1', -999)); // ควรได้ 409 Insufficient stock
}

demo();

// ---------- ตัวอย่าง TEST โดยไม่ต้องมี DB จริง ----------
async function testUpdateStockRejectsNegative() {
  const repo = new InMemoryProductRepository([
    { id: 'p1', name: 'Mouse', category: 'peripherals', priceCents: 79900, stock: 2 },
  ]);
  const useCase = new UpdateStockService(repo);
  try {
    await useCase.execute('p1', -5);
    throw new Error('test failed: expected InsufficientStockError');
  } catch (err) {
    console.assert(err instanceof InsufficientStockError, 'should throw InsufficientStockError');
    console.log('PASS: testUpdateStockRejectsNegative');
  }
}
testUpdateStockRejectsNegative();
```

### เทียบกับ MVC สั้น ๆ

| มิติ                                     | MVC (ถ้าเลือกใช้กับ service นี้)                                                                                       | Hexagonal (ที่เลือกใช้จริง)                                                                             |
| ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| จุดตั้งต้นของการแยกโค้ด                  | แยกตาม "หน้าที่การแสดงผล" (Controller รับ HTTP, View คืน response)                                                     | แยกตาม "ทิศทาง dependency" (core ไม่รู้จักใครเลย)                                                       |
| รองรับ 2 transport (HTTP + CLI) พร้อมกัน | ต้องมี 2 Controller ที่คุยกับ Model เดียวกัน — พอทำได้ แต่ไม่มีขอบเขต "use case" ชัดเจน มัก leak logic เข้า Controller | Use case เดียวถูกเรียกจาก 2 inbound adapter ได้ทันที เพราะ use case ไม่ผูกกับ transport ใดเลยตั้งแต่ต้น |
| Test core โดยไม่มี DB                    | ทำได้ถ้า Model ถูกออกแบบแยก data access ไว้ดี (ไม่ auto-guarantee)                                                     | ทำได้โดย design เพราะ core พึ่งพา `ProductRepositoryPort` (interface) เท่านั้น                          |
| เหมาะกับ                                 | แอปที่ UI เป็นศูนย์กลาง เปลี่ยน transport ไม่บ่อย                                                                      | service ที่ business rule ซับซ้อน/สำคัญ และต้องรองรับหลาย entry point                                   |

**สรุป:** สำหรับ catalog service ที่ต้องรองรับทั้ง HTTP และ CLI พร้อมกัน และทีม QA ต้องการรัน test suite ได้โดยไม่มี DB ในทุก pull request — Hexagonal ให้โครงสร้างที่ "บังคับ" ผลลัพธ์เหล่านี้โดยธรรมชาติ ในขณะที่ MVC ทำได้เหมือนกันแต่ต้องอาศัยความเข้มงวดของทีมมากกว่า (ไม่มีขอบเขต use case ที่ compiler ช่วยบังคับ)

### คำถาม Interview

1. ทำไม `ProductRepositoryPort` ต้องถูกกำหนด (define) อยู่ฝั่ง core ไม่ใช่ฝั่ง adapter? จะเกิดอะไรขึ้นถ้ากำหนดสลับกัน?
2. ถ้าต้องเพิ่ม caching layer (เช่น Redis) หน้า `ProductRepositoryPort` จะเพิ่มที่ไหน ทำไมไม่ควรเพิ่ม logic cache เข้าไปใน `SearchProductsService` ตรง ๆ? (คำตอบที่คาดหวัง: เพิ่มเป็น Decorator/Proxy ที่ implement `ProductRepositoryPort` เอง แล้ว wrap `PostgresProductRepository` ไว้ — core ไม่ต้องรู้เรื่อง cache เลย)
3. เมื่อไหร่ Hexagonal Architecture "ไม่คุ้ม" กับต้นทุนความซับซ้อนที่เพิ่มขึ้น? (คำตอบที่คาดหวัง: CRUD service เล็ก ๆ ที่ไม่มี business rule ซับซ้อน, มี transport เดียว, ทีมเล็กมาก — ต้นทุนของการดูแล ports/adapters หลายไฟล์อาจไม่คุ้มกับความซับซ้อนของ business logic ที่มีจริง)
4. สมมติ QA ขอให้ทดสอบ "search ที่ query มีอักขระพิเศษ (SQL injection pattern)" — อธิบายว่าทำไมการทดสอบผ่าน `InMemoryProductRepository` ไม่ครอบคลุมเคสนี้ และต้องมี test อีกชั้นไหนเพิ่ม (คำตอบที่คาดหวัง: ต้องมี integration/contract test แยกที่รันกับ adapter จริง เช่น `PostgresProductRepository`, เพราะ in-memory ไม่มี SQL layer ให้ทดสอบ — unit test ผ่าน port ทดสอบ "business rule" ส่วน integration test ทดสอบ "adapter ถูก contract ไหม")

---

## Checklist ก่อนขึ้น Expert

- [ ] อธิบายความต่างของ Strategy vs State และ Proxy vs Decorator ได้โดยไม่ต้องดูโค้ด
- [ ] วาด diagram Ports & Adapters จากศูนย์ได้ พร้อมระบุ inbound/outbound port อย่างถูกต้อง
- [ ] อธิบายได้ว่าเมื่อไหร่ MVC เหมาะกว่า MVVM และกลับกัน
- [ ] Refactor giant switch ในโค้ดจริงของทีมได้อย่างน้อย 1 จุด โดยเลือก pattern ที่เหมาะสม ไม่ใช่ใช้ pattern เพราะอยากลองของใหม่

**ถัดไป:** [`../03-expert/README.md`](../03-expert/README.md) — Clean Architecture, DDD, CQRS/Event Sourcing, Saga, CAP/HA/Resilience
