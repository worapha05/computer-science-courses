/**
 * MVC (Model-View-Controller) — Mini Product Catalog
 * ----------------------------------------------------------------
 * TH: MVC แยกโค้ดเป็น 3 ส่วน:
 *  - Model: ข้อมูล + business rules ล้วน ๆ ไม่รู้จัก UI เลย
 *  - View: การแสดงผล (render) รับข้อมูลมาแสดง ไม่มี logic ตัดสินใจ
 *  - Controller: รับ input จากผู้ใช้ เรียก Model ให้เปลี่ยนแปลง แล้วสั่ง View render ใหม่
 *
 *  จุดสำคัญของ MVC แบบ "ดั้งเดิม" (ไม่ใช่ MVC ของ framework บาง framework
 *  ที่ผสมกับ MVVM): Controller เป็นตัว "ดัน" ข้อมูลไปที่ View (View ไม่รู้จัก
 *  Model โดยตรง ต้องผ่าน Controller เสมอ) — ต่างจาก MVVM ที่ View "ผูก" (bind)
 *  กับ ViewModel เองผ่าน observable/reactive mechanism
 *
 * EN: MVC splits code into three parts:
 *  - Model: pure data + business rules, unaware of UI
 *  - View: pure rendering, no decision logic
 *  - Controller: receives user input, mutates the Model, then tells the
 *  View to re-render
 *
 *  Key trait of classic MVC: the Controller actively pushes data to the
 *  View — the View never talks to the Model directly. This differs from
 *  MVVM, where the View binds to the ViewModel via an observable mechanism.
 *
 * รันตัวอย่าง / Run:
 * npx tsx architecture/mvc/mvc.ts
 */

// ============================================================================
// MODEL — pure data + business rules, ไม่รู้จัก View/Controller เลย
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

  addProduct(product: Product): void {
    if (this.findById(product.id)) throw new Error(`Product ${product.id} already exists`);
    this.products.push(product);
  }
}

// ============================================================================
// VIEW — รับข้อมูลมา render อย่างเดียว ไม่มี business logic
// ============================================================================

export class ProductCatalogView {
  renderList(products: readonly Product[]): void {
    console.log(' [View] --- Product Catalog ---');
    for (const p of products) {
      const stockLabel = p.stock === 0 ? 'OUT OF STOCK' : `${p.stock} in stock`;
      console.log(
        ` [View] ${p.id} | ${p.name.padEnd(20)} | $${(p.priceCents / 100).toFixed(2)} | ${stockLabel}`,
      );
    }
  }

  renderError(message: string): void {
    console.log(` [View] ERROR: ${message}`);
  }

  renderSuccess(message: string): void {
    console.log(` [View] OK: ${message}`);
  }
}

// ============================================================================
// CONTROLLER — รับ input, สั่ง Model เปลี่ยนแปลง, สั่ง View render ใหม่
// ============================================================================

export class ProductCatalogController {
  constructor(
    private readonly model: ProductCatalogModel,
    private readonly view: ProductCatalogView,
  ) {}

  showCatalog(): void {
    this.view.renderList(this.model.getAll());
  }

  handleSell(productId: string, qty: number): void {
    try {
      const product = this.model.adjustStock(productId, -qty);
      this.view.renderSuccess(`Sold ${qty}x ${product.name}, remaining stock=${product.stock}`);
    } catch (err) {
      this.view.renderError((err as Error).message);
    }
    // TH: Controller เป็นคนตัดสินใจ "render อีกครั้ง" — View ไม่รู้ตัวเองว่าต้อง refresh เมื่อไหร่
    this.showCatalog();
  }

  handleRestock(productId: string, qty: number): void {
    try {
      const product = this.model.adjustStock(productId, qty);
      this.view.renderSuccess(`Restocked ${qty}x ${product.name}, new stock=${product.stock}`);
    } catch (err) {
      this.view.renderError((err as Error).message);
    }
    this.showCatalog();
  }
}

// ============================================================================
// DEMO
// ============================================================================

function demo() {
  console.log('== MVC Pattern: Product Catalog ==\n');

  const model = new ProductCatalogModel();
  const view = new ProductCatalogView();
  const controller = new ProductCatalogController(model, view);

  controller.showCatalog();

  console.log('\n--- User action: sell 2x Mechanical Keyboard ---');
  controller.handleSell('p1', 2);

  console.log('\n--- User action: try to sell out-of-stock Wireless Mouse ---');
  controller.handleSell('p2', 1);

  console.log('\n--- User action: restock Wireless Mouse ---');
  controller.handleRestock('p2', 10);
}

const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  demo();
}
