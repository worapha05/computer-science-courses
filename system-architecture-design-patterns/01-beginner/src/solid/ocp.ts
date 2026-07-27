/**
 * SOLID — Open/Closed Principle (OCP)
 * ================================================
 * "Software entities should be open for extension, but closed for modification."
 * (module ควร "เปิด" ให้ต่อขยาย feature ใหม่ได้ แต่ "ปิด" ไม่ให้ต้องแก้โค้ดเดิมที่ทดสอบผ่านแล้ว)
 *
 * ตัวอย่างนี้จำลองระบบตัดจ่ายเงิน (Payment) ของระบบ e-commerce
 * - ❌ ANTI-PATTERN: ใช้ if/else หรือ switch-case ไล่ตาม payment method
 * ทุกครั้งที่เพิ่มช่องทางจ่ายเงินใหม่ ต้องแก้โค้ดเดิม (เสี่ยงพังของเก่า, merge conflict บ่อย)
 * - ✅ REFACTORED: ใช้ Strategy-like plugin ผ่าน interface + registry
 * เพิ่มช่องทางใหม่ = เขียน class ใหม่ + register เท่านั้น ไม่แก้ของเดิม
 */

interface PaymentRequest {
  readonly orderId: string;
  readonly amount: number;
}

interface PaymentResult {
  readonly success: boolean;
  readonly transactionRef: string;
  readonly message: string;
}

// ===========================================================================
// ❌ ANTI-PATTERN: switch-case แบบผูกติดกัน (violates OCP)
// ===========================================================================
// ปัญหา: ทุกครั้งที่มี payment method ใหม่ (เช่น "crypto", "buy-now-pay-later")
// ต้องเข้ามาแก้ processPayment ซึ่งเป็น "จุดเดียว" ที่ทุกทีมต้องมาแก้ร่วมกัน
// -> conflict สูง, ต้อง regression test ทั้ง function ใหม่ทุกครั้ง

type LegacyPaymentMethod = 'credit_card' | 'promptpay' | 'true_money';

class PaymentProcessorAntiPattern {
  process(method: LegacyPaymentMethod, request: PaymentRequest): PaymentResult {
    if (method === 'credit_card') {
      return {
        success: true,
        transactionRef: `CC-${request.orderId}`,
        message: `Charged ${request.amount} THB via Credit Card`,
      };
    } else if (method === 'promptpay') {
      return {
        success: true,
        transactionRef: `PP-${request.orderId}`,
        message: `Generated PromptPay QR for ${request.amount} THB`,
      };
    } else if (method === 'true_money') {
      return {
        success: true,
        transactionRef: `TM-${request.orderId}`,
        message: `Deducted ${request.amount} THB from TrueMoney Wallet`,
      };
    }
    // ถ้าอยากเพิ่ม "crypto" ต้องมาแก้ if/else นี้ต่อ ... ไม่มีที่สิ้นสุด
    throw new Error(`Unsupported payment method: ${method}`);
  }
}

// ===========================================================================
// ✅ REFACTORED: Strategy-like plugin architecture (OCP-compliant)
// ===========================================================================
// แนวคิด:
// 1. กำหนด "สัญญา" (interface) กลางที่ทุก payment processor ต้อง implement
// 2. แต่ละช่องทางจ่ายเงินเป็น class ของตัวเอง แยกไฟล์/แยก concern ได้อิสระ
// 3. PaymentGateway ทำหน้าที่ "รวม" processor ทั้งหมดผ่าน registry (open for extension)
// ตัว gateway เองไม่ต้องถูกแก้เลยเมื่อเพิ่ม processor ใหม่ (closed for modification)

interface PaymentMethodProcessor {
  readonly methodCode: string;
  process(request: PaymentRequest): PaymentResult;
}

class CreditCardProcessor implements PaymentMethodProcessor {
  readonly methodCode = 'credit_card';

  process(request: PaymentRequest): PaymentResult {
    return {
      success: true,
      transactionRef: `CC-${request.orderId}`,
      message: `Charged ${request.amount} THB via Credit Card`,
    };
  }
}

class PromptPayProcessor implements PaymentMethodProcessor {
  readonly methodCode = 'promptpay';

  process(request: PaymentRequest): PaymentResult {
    return {
      success: true,
      transactionRef: `PP-${request.orderId}`,
      message: `Generated PromptPay QR for ${request.amount} THB`,
    };
  }
}

class TrueMoneyProcessor implements PaymentMethodProcessor {
  readonly methodCode = 'true_money';

  process(request: PaymentRequest): PaymentResult {
    return {
      success: true,
      transactionRef: `TM-${request.orderId}`,
      message: `Deducted ${request.amount} THB from TrueMoney Wallet`,
    };
  }
}

/**
 * ✨ ตัวอย่างการ "ต่อขยาย" โดยไม่แก้โค้ดเดิมแม้แต่บรรทัดเดียว
 * สมมติวันหนึ่งธุรกิจอยากรับจ่ายด้วย Crypto — เราแค่เพิ่ม class ใหม่นี้
 * แล้วไป register กับ gateway เท่านั้น (ดูใน runDemo ด้านล่าง)
 */
class CryptoProcessor implements PaymentMethodProcessor {
  readonly methodCode = 'crypto';

  process(request: PaymentRequest): PaymentResult {
    return {
      success: true,
      transactionRef: `CRYPTO-${request.orderId}`,
      message: `Broadcasted transaction for ${request.amount} THB equivalent in USDT`,
    };
  }
}

/**
 * PaymentGateway คือจุดที่ "เปิดสำหรับต่อขยาย ปิดสำหรับแก้ไข"
 * - register() คือช่องทางต่อขยาย (extension point)
 * - charge() คือ core logic ที่ "ไม่ต้องแก้" ไม่ว่าจะเพิ่ม processor กี่ตัวก็ตาม
 */
class PaymentGateway {
  private readonly processors = new Map<string, PaymentMethodProcessor>();

  register(processor: PaymentMethodProcessor): this {
    this.processors.set(processor.methodCode, processor);
    return this;
  }

  charge(methodCode: string, request: PaymentRequest): PaymentResult {
    const processor = this.processors.get(methodCode);
    if (!processor) {
      throw new Error(`Unsupported payment method: ${methodCode}`);
    }
    return processor.process(request);
  }
}

// ===========================================================================
// Demo
// ===========================================================================

function runDemo(): void {
  console.log('--- ❌ Anti-pattern: switch-case payment processor ---');
  const legacy = new PaymentProcessorAntiPattern();
  console.log(legacy.process('promptpay', { orderId: 'ORD-1', amount: 500 }).message);

  console.log('\n--- ✅ Refactored: OCP-compliant plugin gateway ---');
  const gateway = new PaymentGateway()
    .register(new CreditCardProcessor())
    .register(new PromptPayProcessor())
    .register(new TrueMoneyProcessor());

  for (const method of ['credit_card', 'promptpay', 'true_money']) {
    const result = gateway.charge(method, { orderId: 'ORD-2', amount: 1200 });
    console.log(`[${method}] ->`, result.message);
  }

  console.log('\n--- ✨ Extend without modifying existing code: adding Crypto ---');
  gateway.register(new CryptoProcessor());
  console.log(gateway.charge('crypto', { orderId: 'ORD-3', amount: 3000 }).message);

  console.log(
    '\nสังเกต: PaymentGateway, CreditCardProcessor, PromptPayProcessor, TrueMoneyProcessor ' +
      "ไม่มีบรรทัดใดถูกแก้เลย เราแค่ 'เพิ่ม' CryptoProcessor เข้ามา แล้ว register — " +
      'นี่คือหัวใจของ Open/Closed Principle',
  );
}

const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  runDemo();
}

export {
  PaymentProcessorAntiPattern,
  PaymentGateway,
  CreditCardProcessor,
  PromptPayProcessor,
  TrueMoneyProcessor,
  CryptoProcessor,
};
export type { PaymentRequest, PaymentResult, PaymentMethodProcessor };
