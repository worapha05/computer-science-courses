/**
 * ADAPTER PATTERN — Legacy Payment Gateway → Modern PaymentPort
 * ----------------------------------------------------------------
 * TH: Adapter แปลง interface ที่เข้ากันไม่ได้ (เก่า/ภายนอก/3rd-party) ให้ตรงกับ
 *  interface ที่ระบบของเราต้องการ โดยไม่ต้องแก้โค้ดเดิมของ vendor และไม่ต้อง
 *  ให้ business logic รู้จัก interface แปลก ๆ ของแต่ละเจ้า
 * EN: Adapter converts an incompatible interface (legacy / vendor / 3rd-party)
 *  into the interface our system expects, without touching vendor code and
 *  without leaking vendor-specific shapes into business logic.
 *
 * รันตัวอย่าง / Run:
 * npx tsx structural/adapter/adapter.ts
 */

// ============================================================================
// 1) TARGET INTERFACE — สิ่งที่ระบบของเรา "ต้องการ" (Port ฝั่ง business logic)
// The interface OUR application depends on. Business logic never imports
// vendor SDKs directly — only this port.
// ============================================================================

export interface ChargeRequest {
  amountCents: number; // ใช้ cents/satang เสมอ เลี่ยง floating point error
  currency: 'THB' | 'USD';
  customerRef: string;
  description: string;
}

export interface ChargeResult {
  success: boolean;
  providerTransactionId: string;
  raw?: unknown; // เก็บ payload ดิบไว้ debug เท่านั้น ห้าม business logic พึ่งพา
}

/** TH: "PaymentPort" คือสัญญาที่ business logic ใช้เรียก โดยไม่รู้ว่าข้างหลังเป็น vendor ไหน
 * EN: The contract business logic calls, agnostic of the underlying vendor. */
export interface PaymentPort {
  charge(request: ChargeRequest): Promise<ChargeResult>;
  refund(providerTransactionId: string, amountCents: number): Promise<ChargeResult>;
}

// ============================================================================
// 2) ADAPTEES — SDK/ระบบเก่าของแต่ละ vendor (เราแก้โค้ดพวกนี้ไม่ได้)
// Legacy/vendor SDKs we do NOT control. Each has its own quirky shape.
// ============================================================================

/** Vendor A: ระบบ legacy ภายในบริษัท ใช้ XML-like object เก่า, เงินหน่วยเป็นบาท (float) */
class LegacyInHouseGateway {
  submitPaymentXmlLike(payload: { AMOUNT_BAHT: number; ACCOUNT_ID: string; MEMO: string }): {
    STATUS_CODE: '00' | '99';
    REF_NO: string;
  } {
    console.log(
      ` [LegacyInHouseGateway] ตัดเงิน ${payload.AMOUNT_BAHT} บาท จาก ${payload.ACCOUNT_ID}`,
    );
    return { STATUS_CODE: '00', REF_NO: `LEGACY-${Date.now()}` };
  }

  reverseTransaction(
    refNo: string,
    amountBaht: number,
  ): { STATUS_CODE: '00' | '99'; REF_NO: string } {
    console.log(` [LegacyInHouseGateway] คืนเงิน ${amountBaht} บาท ref=${refNo}`);
    return { STATUS_CODE: '00', REF_NO: `${refNo}-REV` };
  }
}

/** Vendor B: Stripe-like SDK สมัยใหม่ แต่ใช้ชื่อ method/field ต่างจาก port ของเรา */
class StripeLikeSdk {
  async createCharge(opts: {
    amount: number;
    currency: string;
    customer: string;
    description: string;
  }): Promise<{
    id: string;
    status: 'succeeded' | 'failed';
  }> {
    console.log(` [StripeLikeSdk] createCharge amount=${opts.amount} ${opts.currency}`);
    return { id: `pi_${Math.random().toString(36).slice(2)}`, status: 'succeeded' };
  }

  async createRefund(
    chargeId: string,
    amount: number,
  ): Promise<{ id: string; status: 'succeeded' | 'failed' }> {
    console.log(` [StripeLikeSdk] createRefund for ${chargeId} amount=${amount}`);
    return { id: `re_${Math.random().toString(36).slice(2)}`, status: 'succeeded' };
  }
}

/** Vendor C: local e-wallet ที่ใช้ callback-style API (ไม่มี Promise) */
class LocalWalletCallbackApi {
  pay(
    walletId: string,
    satang: number,
    note: string,
    callback: (err: Error | null, result?: { txId: string }) => void,
  ): void {
    console.log(` [LocalWalletCallbackApi] pay satang=${satang} wallet=${walletId} note=${note}`);
    setTimeout(() => callback(null, { txId: `WALLET-${Date.now()}` }), 0);
  }

  refund(
    walletId: string,
    txId: string,
    satang: number,
    callback: (err: Error | null, result?: { txId: string }) => void,
  ): void {
    setTimeout(() => callback(null, { txId: `${txId}-R` }), 0);
  }
}

// ============================================================================
// 3) ADAPTERS — แปลง Adaptee ให้เป็น PaymentPort
// Each adapter implements PaymentPort by delegating to its wrapped vendor.
// ============================================================================

export class LegacyInHouseAdapter implements PaymentPort {
  constructor(private readonly legacy: LegacyInHouseGateway) {}

  async charge(request: ChargeRequest): Promise<ChargeResult> {
    if (request.currency !== 'THB') {
      // TH: adapter คือที่เดียวที่ควรมี logic เฉพาะ vendor แบบนี้
      // EN: vendor-specific constraints belong here, not in business logic
      throw new Error('LegacyInHouseGateway supports THB only');
    }
    const amountBaht = request.amountCents / 100;
    const res = this.legacy.submitPaymentXmlLike({
      AMOUNT_BAHT: amountBaht,
      ACCOUNT_ID: request.customerRef,
      MEMO: request.description,
    });
    return {
      success: res.STATUS_CODE === '00',
      providerTransactionId: res.REF_NO,
      raw: res,
    };
  }

  async refund(providerTransactionId: string, amountCents: number): Promise<ChargeResult> {
    const res = this.legacy.reverseTransaction(providerTransactionId, amountCents / 100);
    return { success: res.STATUS_CODE === '00', providerTransactionId: res.REF_NO, raw: res };
  }
}

export class StripeLikeAdapter implements PaymentPort {
  constructor(private readonly sdk: StripeLikeSdk) {}

  async charge(request: ChargeRequest): Promise<ChargeResult> {
    const res = await this.sdk.createCharge({
      amount: request.amountCents,
      currency: request.currency.toLowerCase(),
      customer: request.customerRef,
      description: request.description,
    });
    return { success: res.status === 'succeeded', providerTransactionId: res.id, raw: res };
  }

  async refund(providerTransactionId: string, amountCents: number): Promise<ChargeResult> {
    const res = await this.sdk.createRefund(providerTransactionId, amountCents);
    return { success: res.status === 'succeeded', providerTransactionId: res.id, raw: res };
  }
}

/** TH: adapter นี้ต้อง "promisify" callback API ด้วย — เป็นหน้าที่ของ adapter เช่นกัน
 * EN: this adapter must also promisify the callback API — still adapter's job */
export class LocalWalletAdapter implements PaymentPort {
  private walletId: string | undefined;

  constructor(private readonly wallet: LocalWalletCallbackApi) {}

  async charge(request: ChargeRequest): Promise<ChargeResult> {
    this.walletId = request.customerRef;
    return new Promise((resolve, reject) => {
      this.wallet.pay(
        request.customerRef,
        request.amountCents,
        request.description,
        (err, result) => {
          if (err || !result) return reject(err ?? new Error('wallet payment failed'));
          resolve({ success: true, providerTransactionId: result.txId, raw: result });
        },
      );
    });
  }

  async refund(providerTransactionId: string, amountCents: number): Promise<ChargeResult> {
    return new Promise((resolve, reject) => {
      this.wallet.refund(this.walletId!, providerTransactionId, amountCents, (err, result) => {
        if (err || !result) return reject(err ?? new Error('wallet refund failed'));
        resolve({ success: true, providerTransactionId: result.txId, raw: result });
      });
    });
  }
}

// ============================================================================
// 4) BUSINESS LOGIC — รู้จักแค่ PaymentPort เท่านั้น ไม่รู้จัก vendor ไหนเลย
// Business logic depends only on PaymentPort. Swapping vendors = zero changes here.
// ============================================================================

class CheckoutService {
  constructor(private readonly paymentPort: PaymentPort) {}

  async checkout(customerRef: string, amountCents: number, currency: 'THB' | 'USD'): Promise<void> {
    const result = await this.paymentPort.charge({
      amountCents,
      currency,
      customerRef,
      description: 'Order checkout',
    });
    console.log(
      ` -> Checkout ${result.success ? 'SUCCESS' : 'FAILED'} (txId=${result.providerTransactionId})\n`,
    );
  }
}

// ============================================================================
// DEMO
// ============================================================================

async function demo() {
  console.log('== Adapter Pattern: 3 payment vendors ผ่าน PaymentPort เดียว ==\n');

  const vendors: Array<{ name: string; port: PaymentPort; currency: 'THB' | 'USD' }> = [
    {
      name: 'Legacy In-House Gateway',
      port: new LegacyInHouseAdapter(new LegacyInHouseGateway()),
      currency: 'THB',
    },
    { name: 'Stripe-like SDK', port: new StripeLikeAdapter(new StripeLikeSdk()), currency: 'USD' },
    {
      name: 'Local Wallet (callback API)',
      port: new LocalWalletAdapter(new LocalWalletCallbackApi()),
      currency: 'THB',
    },
  ];

  for (const vendor of vendors) {
    console.log(`--- Vendor: ${vendor.name} ---`);
    const checkout = new CheckoutService(vendor.port);
    await checkout.checkout('customer-123', 25000, vendor.currency);
  }
}

const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  demo();
}
