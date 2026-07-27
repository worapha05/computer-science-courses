/**
 * STRATEGY PATTERN — Shipping Cost Strategies (Flat, Weight-based, Distance-based)
 * ----------------------------------------------------------------
 * TH: Strategy แยก "algorithm" ที่สลับกันได้ ออกจาก context ที่ใช้มัน
 *  ทำให้เพิ่ม algorithm ใหม่ได้โดยไม่แก้ context (Open/Closed Principle)
 *  และเลือก algorithm ได้ตอน runtime (ตาม config, region, A/B test)
 * EN: Strategy extracts an interchangeable algorithm out of the context that
 *  uses it. New algorithms can be added without touching the context
 *  (Open/Closed), and the algorithm can be chosen at runtime.
 *
 * เมื่อไหร่ควรใช้:
 * TH: - มี if/switch ตาม "ประเภท" ที่ทำนายการคำนวณต่างกัน และ "ประเภท" นั้นจะ
 *  เพิ่มขึ้นเรื่อย ๆ ตามธุรกิจ (shipping method, pricing tier, tax rule)
 *  - ต้องการ unit test แต่ละ algorithm แยกจากกันได้ง่าย
 * EN: - You have branching by "kind" that computes differently, and new kinds
 *  keep appearing as the business grows.
 *  - You want to unit test each algorithm in isolation.
 *
 * Anti-pattern: สร้าง Strategy สำหรับ logic ที่ไม่เคยเปลี่ยนและไม่มีแนวโน้มจะ
 * เพิ่ม variant ใหม่ — เพิ่ม indirection โดยไม่ได้ประโยชน์ (overengineering)
 *
 * รันตัวอย่าง / Run:
 * npx tsx behavioral/strategy/strategy.ts
 */

// ============================================================================
// 1) STRATEGY INTERFACE
// ============================================================================

export interface ShippingContext {
  weightKg: number;
  distanceKm: number;
  orderValueCents: number;
}

export interface ShippingStrategy {
  readonly name: string;
  calculate(ctx: ShippingContext): number; // returns cost in cents
}

// ============================================================================
// 2) CONCRETE STRATEGIES
// ============================================================================

export class FlatRateShipping implements ShippingStrategy {
  readonly name = 'FlatRate';

  constructor(private readonly flatCents: number = 5000) {}

  calculate(_ctx: ShippingContext): number {
    return this.flatCents;
  }
}

export class WeightBasedShipping implements ShippingStrategy {
  readonly name = 'WeightBased';

  constructor(
    private readonly baseCents: number = 2000,
    private readonly perKgCents: number = 1500,
  ) {}

  calculate(ctx: ShippingContext): number {
    return this.baseCents + Math.ceil(ctx.weightKg) * this.perKgCents;
  }
}

export class DistanceBasedShipping implements ShippingStrategy {
  readonly name = 'DistanceBased';

  constructor(
    private readonly baseCents: number = 3000,
    private readonly perKmCents: number = 50,
  ) {}

  calculate(ctx: ShippingContext): number {
    return this.baseCents + Math.ceil(ctx.distanceKm) * this.perKmCents;
  }
}

/** TH: strategy ที่ผสมเกณฑ์อื่นเข้ามา (free shipping เมื่อสั่งเกินยอด) — โชว์ว่า
 *  strategy สามารถมี logic ซับซ้อนของตัวเองได้อย่างเป็นอิสระ
 * EN: a strategy with its own extra rule (free shipping above a threshold) —
 *  shows strategies can carry independent, self-contained logic */
export class FreeShippingOverThreshold implements ShippingStrategy {
  readonly name = 'FreeOverThreshold';

  constructor(
    private readonly thresholdCents: number,
    private readonly fallback: ShippingStrategy,
  ) {}

  calculate(ctx: ShippingContext): number {
    if (ctx.orderValueCents >= this.thresholdCents) return 0;
    return this.fallback.calculate(ctx);
  }
}

// ============================================================================
// 3) CONTEXT — ไม่รู้จัก strategy รายละเอียด รู้แค่ interface
// ============================================================================

export class ShippingCalculator {
  constructor(private strategy: ShippingStrategy) {}

  setStrategy(strategy: ShippingStrategy): void {
    console.log(` [ShippingCalculator] switching strategy -> ${strategy.name}`);
    this.strategy = strategy;
  }

  quote(ctx: ShippingContext): number {
    const cost = this.strategy.calculate(ctx);
    console.log(
      ` [ShippingCalculator] strategy=${this.strategy.name} weight=${ctx.weightKg}kg distance=${ctx.distanceKm}km -> ${cost} cents`,
    );
    return cost;
  }
}

// ============================================================================
// 4) STRATEGY SELECTOR — ตัวอย่าง factory เลือก strategy ตาม business rule
// (มักคู่กับ Strategy pattern ในระบบจริง)
// ============================================================================

export function selectStrategy(
  method: 'flat' | 'weight' | 'distance',
  orderValueCents: number,
): ShippingStrategy {
  const base: ShippingStrategy =
    method === 'flat'
      ? new FlatRateShipping()
      : method === 'weight'
        ? new WeightBasedShipping()
        : new DistanceBasedShipping();

  // TH: ทุก method สามารถถูกฟรีค่าส่งได้ถ้ายอดสั่งซื้อสูงพอ — compose strategy ได้
  return new FreeShippingOverThreshold(100000, base);
}

// ============================================================================
// DEMO
// ============================================================================

function demo() {
  console.log('== Strategy Pattern: Shipping cost calculation ==\n');

  const ctx: ShippingContext = { weightKg: 3.4, distanceKm: 120, orderValueCents: 45000 };

  const calculator = new ShippingCalculator(new FlatRateShipping());
  calculator.quote(ctx);

  calculator.setStrategy(new WeightBasedShipping());
  calculator.quote(ctx);

  calculator.setStrategy(new DistanceBasedShipping());
  calculator.quote(ctx);

  console.log('\n--- ใช้ selectStrategy() ตาม business rule ---');
  const bigOrderCtx: ShippingContext = { weightKg: 2, distanceKm: 30, orderValueCents: 150000 };
  const strategy = selectStrategy('weight', bigOrderCtx.orderValueCents);
  calculator.setStrategy(strategy);
  calculator.quote(bigOrderCtx); // ควรได้ 0 เพราะเกิน threshold
}

const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  demo();
}
