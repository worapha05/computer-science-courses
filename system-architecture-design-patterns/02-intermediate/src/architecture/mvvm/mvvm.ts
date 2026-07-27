/**
 * MVVM (Model-View-ViewModel) — Same Product Catalog Domain as MVC, for comparison
 * ----------------------------------------------------------------
 * TH: MVVM แยกเป็น 3 ส่วนเหมือน MVC แต่ "ความสัมพันธ์" ต่างกัน:
 *  - Model: เหมือน MVC เดิม (data + business rules)
 *  - ViewModel: เก็บ "state ที่ View ต้องการแสดง" ในรูปแบบ observable/reactive
 *  และมี method ให้ View เรียก (เช่น sell(), restock()) แต่ ViewModel ไม่รู้จัก
 *  View โดยตรง (ไม่มี reference ถึง DOM/Console/Component)
 *  - View: "subscribe" (bind) กับ ViewModel เอง แล้ว auto re-render เมื่อ state
 *  เปลี่ยน — View ไม่ต้องถูก "สั่ง" ให้ render ใหม่แบบ MVC (ไม่มี Controller
 *  เป็นตัวกลางที่ push ทีละ action)
 *
 *  สรุปความต่างสำคัญ: MVC = Controller "push" ข้อมูลไปที่ View ทีละครั้ง
 *  MVVM = View "pull/subscribe" ข้อมูลจาก ViewModel ผ่าน binding ทำให้ View
 *  ซิงค์กับ state โดยอัตโนมัติ เหมาะกับ UI ที่มี state เปลี่ยนบ่อยและมาจาก
 *  หลายจุด (เช่น frontend framework: React/Vue/WPF/SwiftUI)
 *
 * EN: MVVM has the same 3 parts as MVC, but the relationship differs:
 *  - Model: same as MVC (data + business rules)
 *  - ViewModel: holds display-ready state as observables, exposes methods
 *  the View calls, but never references the View directly
 *  - View: subscribes/binds to the ViewModel and auto re-renders on change
 *  — no Controller pushing renders after each action
 *
 *  Key difference: MVC's Controller *pushes* to the View per action; MVVM's
 *  View *pulls/subscribes* via binding, so it stays in sync automatically.
 *  This fits UIs with frequent, multi-sourced state changes (React/Vue/
 *  WPF/SwiftUI).
 *
 * รันตัวอย่าง / Run:
 * npx tsx architecture/mvvm/mvvm.ts
 */

// ============================================================================
// MODEL — เหมือนกับตัวอย่าง MVC (data + business rules)
// ============================================================================

export interface Product {
  id: string;
  name: string;
  priceCents: number;
  stock: number;
}

export class ProductCatalogModel {
  private products: Product[] = [
    { id: 'p1', name: 'Mechanical Keyboard', priceCents: 259900, stock: 12 },
    { id: 'p2', name: 'Wireless Mouse', priceCents: 79900, stock: 0 },
    { id: 'p3', name: 'USB-C Hub', priceCents: 129900, stock: 34 },
  ];

  getAll(): readonly Product[] {
    return this.products;
  }

  findById(id: string): Product | undefined {
    return this.products.find((p) => p.id === id);
  }

  adjustStock(id: string, delta: number): Product {
    const product = this.findById(id);
    if (!product) throw new Error(`Product ${id} not found`);
    const newStock = product.stock + delta;
    if (newStock < 0) throw new Error(`Cannot reduce stock below zero for ${id}`);
    product.stock = newStock;
    return product;
  }
}

// ============================================================================
// MINI OBSERVABLE — จำลอง reactive primitive (เช่น RxJS BehaviorSubject / Vue ref)
// ============================================================================

class Observable<T> {
  private readonly listeners = new Set<(value: T) => void>();

  constructor(private value: T) {}

  get(): T {
    return this.value;
  }

  set(next: T): void {
    this.value = next;
    for (const listener of this.listeners) listener(next);
  }

  subscribe(listener: (value: T) => void): () => void {
    this.listeners.add(listener);
    listener(this.value); // TH: ส่งค่าปัจจุบันทันทีตอน subscribe (เหมือน BehaviorSubject)
    return () => this.listeners.delete(listener);
  }
}

// ============================================================================
// VIEWMODEL — เก็บ display state แบบ observable, ไม่รู้จัก View
// ============================================================================

export interface ProductRow {
  id: string;
  label: string;
  priceLabel: string;
  stockLabel: string;
  canSell: boolean;
}

export class ProductCatalogViewModel {
  /** TH: นี่คือ "state สำหรับแสดงผล" ล้วน ๆ ไม่ใช่ raw Model — ViewModel ทำหน้าที่
   *  transform ข้อมูลให้พร้อมแสดง (view-friendly shape) */
  readonly rows: Observable<ProductRow[]>;
  readonly statusMessage: Observable<string>;

  constructor(private readonly model: ProductCatalogModel) {
    this.rows = new Observable(this.toRows());
    this.statusMessage = new Observable('');
  }

  private toRows(): ProductRow[] {
    return this.model.getAll().map((p) => ({
      id: p.id,
      label: p.name,
      priceLabel: `$${(p.priceCents / 100).toFixed(2)}`,
      stockLabel: p.stock === 0 ? 'OUT OF STOCK' : `${p.stock} in stock`,
      canSell: p.stock > 0,
    }));
  }

  sell(productId: string, qty: number): void {
    try {
      const product = this.model.adjustStock(productId, -qty);
      this.statusMessage.set(`Sold ${qty}x ${product.name}, remaining stock=${product.stock}`);
    } catch (err) {
      this.statusMessage.set(`ERROR: ${(err as Error).message}`);
    }
    // TH: update rows -> View ที่ subscribe ไว้จะ re-render "อัตโนมัติ" ไม่ต้องมีใครสั่ง
    // EN: updating rows automatically re-renders any subscribed View — no explicit push needed
    this.rows.set(this.toRows());
  }

  restock(productId: string, qty: number): void {
    try {
      const product = this.model.adjustStock(productId, qty);
      this.statusMessage.set(`Restocked ${qty}x ${product.name}, new stock=${product.stock}`);
    } catch (err) {
      this.statusMessage.set(`ERROR: ${(err as Error).message}`);
    }
    this.rows.set(this.toRows());
  }
}

// ============================================================================
// VIEW — bind (subscribe) เข้ากับ ViewModel เอง ไม่มี Controller เป็นตัวกลาง
// ============================================================================

export class ProductCatalogView {
  constructor(viewModel: ProductCatalogViewModel) {
    // TH: "data binding" จำลองด้วย subscribe — ทุกครั้งที่ rows เปลี่ยน จะ render เอง
    // EN: "data binding" simulated via subscribe — re-renders itself whenever rows change
    viewModel.rows.subscribe((rows) => this.render(rows));
    viewModel.statusMessage.subscribe((message) => {
      if (message) console.log(` [View] status: ${message}`);
    });
  }

  private render(rows: ProductRow[]): void {
    console.log(' [View] --- Product Catalog (auto re-rendered via binding) ---');
    for (const row of rows) {
      console.log(
        ` [View] ${row.id} | ${row.label.padEnd(20)} | ${row.priceLabel} | ${row.stockLabel}`,
      );
    }
  }
}

// ============================================================================
// DEMO
// ============================================================================

function demo() {
  console.log('== MVVM Pattern: Product Catalog (compare with MVC above) ==\n');

  const model = new ProductCatalogModel();
  const viewModel = new ProductCatalogViewModel(model);
  // TH: ตอนสร้าง View มันจะ subscribe แล้ว render ทันที (ไม่ต้องมีใครเรียก showCatalog())
  new ProductCatalogView(viewModel);

  console.log('\n--- User action via ViewModel: sell 2x Mechanical Keyboard ---');
  viewModel.sell('p1', 2); // View re-renders automatically because rows Observable changed

  console.log('\n--- User action via ViewModel: try to sell out-of-stock Wireless Mouse ---');
  viewModel.sell('p2', 1);

  console.log('\n--- User action via ViewModel: restock Wireless Mouse ---');
  viewModel.restock('p2', 10);
}

const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  demo();
}
