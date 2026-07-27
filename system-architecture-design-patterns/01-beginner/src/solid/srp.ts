/**
 * SOLID — Single Responsibility Principle (SRP)
 * ================================================
 * "A class should have one, and only one, reason to change."
 * (class ควรมีเหตุผลในการถูกแก้ไข/เปลี่ยนแปลงเพียงเหตุผลเดียว)
 *
 * ตัวอย่างนี้จำลองระบบออกใบแจ้งหนี้ (Invoice) ของร้านค้าออนไลน์
 * - ฝั่ง ❌ ANTI-PATTERN: InvoiceService เดียวทำทุกอย่าง (คำนวณ, สร้างรายงาน, บันทึกลง DB, แจ้งเตือนลูกค้า)
 * - ฝั่ง ✅ REFACTORED: แยกความรับผิดชอบออกเป็นคนละ class ประสานงานผ่าน orchestrator
 */

// ===========================================================================
// Shared domain model
// ===========================================================================

interface InvoiceLineItem {
  readonly productName: string;
  readonly unitPrice: number;
  readonly quantity: number;
}

interface Invoice {
  readonly id: string;
  readonly customerEmail: string;
  readonly items: readonly InvoiceLineItem[];
}

function calculateTotal(invoice: Invoice): number {
  return invoice.items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
}

// ===========================================================================
// ❌ ANTI-PATTERN: "God class" ที่ละเมิด SRP
// ===========================================================================
// ปัญหา:
// 1. เหตุผลในการแก้ไข class นี้มีหลายเหตุผลปนกัน:
// - เปลี่ยน "รูปแบบรายงาน" (formatReport) -> ทีม Reporting
// - เปลี่ยน "วิธีเก็บข้อมูล" (saveToDatabase) -> ทีม Data/Infra
// - เปลี่ยน "วิธีแจ้งเตือน" (sendEmail)  -> ทีม Notification
// 2. เทสยาก: จะเทส "การคำนวณยอดรวม" ต้อง mock ทั้ง DB และ SMTP ไปด้วย
// 3. Reuse ยาก: อยากใช้แค่ logic คำนวณในบริบทอื่น ก็ดึงแยกไม่ได้ เพราะมันผูกกับ side-effect อื่น

class InvoiceServiceAntiPattern {
  generateAndSend(invoice: Invoice): void {
    // 1) คำนวณยอดรวม (business logic)
    const total = calculateTotal(invoice);

    // 2) จัดรูปแบบรายงาน (presentation concern)
    const report = [
      `=== Invoice #${invoice.id} ===`,
      ...invoice.items.map(
        (i) => `${i.productName} x${i.quantity} = ${(i.unitPrice * i.quantity).toFixed(2)}`,
      ),
      `Total: ${total.toFixed(2)}`,
    ].join('\n');
    console.log(report);

    // 3) บันทึกลงฐานข้อมูล (persistence concern) — ผูกติดกับ "MySQL" ตรง ๆ
    console.log(`[MySQL] INSERT INTO invoices (id, total) VALUES ('${invoice.id}', ${total})`);

    // 4) ส่งอีเมลแจ้งลูกค้า (notification concern) — ผูกติดกับ "SMTP" ตรง ๆ
    console.log(
      `[SMTP] Sending email to ${invoice.customerEmail}: "Your invoice total is ${total.toFixed(2)}"`,
    );

    // ถ้าพรุ่งนี้ต้อง "ส่ง LINE Notify แทนอีเมล" หรือ "เปลี่ยนจาก MySQL เป็น Postgres"
    // ก็ต้องมาแก้ class เดียวกันนี้ ทั้งที่ business logic (คำนวณยอดรวม) ไม่ได้เปลี่ยนเลย
  }
}

// ===========================================================================
// ✅ REFACTORED: แยกความรับผิดชอบตาม SRP
// ===========================================================================
// แนวคิด: แต่ละ class มี "เหตุผลในการเปลี่ยนแปลง" เพียงหนึ่งเดียว
// - InvoiceReportFormatter : เปลี่ยนเมื่อ "รูปแบบการแสดงผล" เปลี่ยน
// - InvoiceRepository  : เปลี่ยนเมื่อ "กลไกการจัดเก็บข้อมูล" เปลี่ยน
// - InvoiceNotifier  : เปลี่ยนเมื่อ "ช่องทางการแจ้งเตือน" เปลี่ยน
// - InvoiceService   : orchestrator ที่ประสานงาน ไม่ได้ทำงานเองทั้งหมด

interface InvoiceReportFormatter {
  format(invoice: Invoice, total: number): string;
}

class PlainTextInvoiceFormatter implements InvoiceReportFormatter {
  format(invoice: Invoice, total: number): string {
    return [
      `=== Invoice #${invoice.id} ===`,
      ...invoice.items.map(
        (i) => `${i.productName} x${i.quantity} = ${(i.unitPrice * i.quantity).toFixed(2)}`,
      ),
      `Total: ${total.toFixed(2)}`,
    ].join('\n');
  }
}

interface InvoiceRepository {
  save(invoice: Invoice, total: number): void;
}

class MySqlInvoiceRepository implements InvoiceRepository {
  save(invoice: Invoice, total: number): void {
    // ในโปรดักชันจริงจะเป็น connection pool + prepared statement
    console.log(`[MySQL] INSERT INTO invoices (id, total) VALUES ('${invoice.id}', ${total})`);
  }
}

interface InvoiceNotifier {
  notifyCustomer(invoice: Invoice, total: number): void;
}

class EmailInvoiceNotifier implements InvoiceNotifier {
  notifyCustomer(invoice: Invoice, total: number): void {
    console.log(
      `[SMTP] Sending email to ${invoice.customerEmail}: "Your invoice total is ${total.toFixed(2)}"`,
    );
  }
}

/**
 * InvoiceService ทำหน้าที่เป็น "ผู้ประสานงาน" (orchestrator) เท่านั้น
 * ไม่มี business logic ของ formatting / persistence / notification อยู่ในตัวมันเอง
 * ทำให้เหตุผลเดียวที่มันจะเปลี่ยนคือ "ลำดับขั้นตอนการออกใบแจ้งหนี้เปลี่ยน"
 */
class InvoiceService {
  constructor(
    private readonly formatter: InvoiceReportFormatter,
    private readonly repository: InvoiceRepository,
    private readonly notifier: InvoiceNotifier,
  ) {}

  generateAndSend(invoice: Invoice): void {
    const total = calculateTotal(invoice);

    const report = this.formatter.format(invoice, total);
    console.log(report);

    this.repository.save(invoice, total);
    this.notifier.notifyCustomer(invoice, total);
  }
}

// ===========================================================================
// Demo
// ===========================================================================

const sampleInvoice: Invoice = {
  id: 'INV-1001',
  customerEmail: 'customer@example.com',
  items: [
    { productName: 'Mechanical Keyboard', unitPrice: 2500, quantity: 1 },
    { productName: 'USB-C Cable', unitPrice: 150, quantity: 2 },
  ],
};

function runDemo(): void {
  console.log('\n--- ❌ Anti-pattern: God class ---');
  new InvoiceServiceAntiPattern().generateAndSend(sampleInvoice);

  console.log('\n--- ✅ Refactored: SRP-compliant ---');
  const service = new InvoiceService(
    new PlainTextInvoiceFormatter(),
    new MySqlInvoiceRepository(),
    new EmailInvoiceNotifier(),
  );
  service.generateAndSend(sampleInvoice);

  console.log(
    '\nสังเกต: ถ้าต้องเปลี่ยนช่องทางแจ้งเตือนเป็น LINE Notify ใน version refactored ' +
      'เราแค่เขียน LineNotifyInvoiceNotifier ใหม่ แล้วสลับ dependency ตอน compose ' +
      'โดยไม่ต้องแก้ InvoiceService, formatter หรือ repository เลย',
  );
}

const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  runDemo();
}

export {
  InvoiceServiceAntiPattern,
  InvoiceService,
  PlainTextInvoiceFormatter,
  MySqlInvoiceRepository,
  EmailInvoiceNotifier,
  calculateTotal,
};
export type {
  Invoice,
  InvoiceLineItem,
  InvoiceReportFormatter,
  InvoiceRepository,
  InvoiceNotifier,
};
