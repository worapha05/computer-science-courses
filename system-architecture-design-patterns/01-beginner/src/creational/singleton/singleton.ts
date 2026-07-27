/**
 * Creational Pattern — Singleton
 * ================================================
 * เจตนา: การันตีว่า class หนึ่งมี "instance เดียว" ในระบบ และมี global access point
 * ไปหา instance นั้น เหมาะกับสิ่งที่ควรมีชุดเดียวจริง ๆ เช่น configuration ที่โหลดครั้งเดียว,
 * connection pool, logger กลาง
 *
 * ⚠️ ข้อควรระวังสำคัญ:
 * 1. Singleton มักถูกใช้ผิด ๆ เป็น "global mutable state" แฝงมา ทำให้เทสยาก (hidden dependency)
 * 2. ใน Node.js แบบ single-thread ปัญหา race condition ของการ "สร้าง instance ซ้ำ" มักไม่เกิด
 * จาก multi-threading เหมือนภาษาอื่น (Java/C#) แต่ยังเกิดได้จาก "async lazy init"
 * เช่น ถ้า getInstance() เป็น async และมีหลาย call เข้ามาพร้อมกันก่อน instance
 * จะถูกสร้างเสร็จ ก็อาจสร้างซ้ำได้ถ้าไม่ระมัดระวัง (ตัวอย่างที่ 2 ด้านล่าง)
 * 3. ทางเลือกที่ดีกว่าในโค้ดสมัยใหม่ (โดยเฉพาะเวลาต้องเทส) คือ "DI-friendly module-scoped
 * singleton" หรือปล่อยให้ DI container คุมอายุของ instance แทนการ hardcode getInstance()
 */

// ===========================================================================
// (1) Singleton แบบ classic — Lazy initialization, synchronous
// ===========================================================================
// ConfigManager จำลองการโหลด config จาก environment variables ครั้งเดียว
// แล้วให้ทุกส่วนของระบบอ่านค่าเดิมร่วมกัน

interface AppConfig {
  readonly appName: string;
  readonly port: number;
  readonly databaseUrl: string;
}

class ConfigManager {
  // private static field เก็บ instance เดียวของ class
  private static instance: ConfigManager | undefined;

  private readonly config: AppConfig;
  private loadCount = 0;

  // constructor เป็น private -> ห้าม `new ConfigManager()` จากภายนอกโดยตรง
  private constructor() {
    this.config = this.loadConfigFromEnv();
    this.loadCount += 1;
  }

  /**
   * Lazy initialization: สร้าง instance ก็ต่อเมื่อถูกเรียกใช้ครั้งแรกเท่านั้น
   * (ไม่ใช่สร้างตั้งแต่ module ถูก import — ประหยัด resource ถ้าสุดท้ายไม่ได้ใช้)
   */
  static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  /** สำหรับเทสเท่านั้น — reset instance เพื่อไม่ให้ state รั่วไหลข้ามเทสเคส */
  static resetForTesting(): void {
    ConfigManager.instance = undefined;
  }

  private loadConfigFromEnv(): AppConfig {
    return {
      appName: process.env.APP_NAME ?? 'architecture-beginner',
      port: Number(process.env.PORT ?? 3000),
      databaseUrl: process.env.DATABASE_URL ?? 'mysql://localhost:3306/app',
    };
  }

  get(): AppConfig {
    return this.config;
  }

  getLoadCount(): number {
    return this.loadCount;
  }
}

// ===========================================================================
// (2) ตัวอย่าง "async lazy init race condition" ที่พบได้จริงใน Node.js
// ===========================================================================
// สถานการณ์: ConnectionPoolAntiPattern เชื่อมต่อ DB แบบ async (เช่น รอ handshake)
// ถ้ามีหลาย call เข้ามา "พร้อมกัน" ก่อนที่ instance แรกจะสร้างเสร็จ (await ยังไม่ resolve)
// เงื่อนไข `if (!instance)` จะเป็น true ในทุก call เพราะ instance ยังไม่ถูก assign
// -> เกิดการเชื่อมต่อซ้ำหลายครั้งทั้งที่ตั้งใจให้มี pool เดียว

class ConnectionPoolAntiPattern {
  private static instance: ConnectionPoolAntiPattern | undefined;
  static connectionCount = 0;

  private constructor(public readonly id: number) {}

  private static async connect(): Promise<ConnectionPoolAntiPattern> {
    // จำลอง latency ของการเชื่อมต่อจริง (เช่น TLS handshake, DNS lookup)
    await new Promise((resolve) => setTimeout(resolve, 20));
    ConnectionPoolAntiPattern.connectionCount += 1;
    return new ConnectionPoolAntiPattern(ConnectionPoolAntiPattern.connectionCount);
  }

  // ❌ ปัญหา: ระหว่างรอ await connect() หลาย caller จะเห็น instance เป็น undefined พร้อมกัน
  static async getInstance(): Promise<ConnectionPoolAntiPattern> {
    if (!ConnectionPoolAntiPattern.instance) {
      ConnectionPoolAntiPattern.instance = await ConnectionPoolAntiPattern.connect();
    }
    return ConnectionPoolAntiPattern.instance;
  }

  static resetForTesting(): void {
    ConnectionPoolAntiPattern.instance = undefined;
    ConnectionPoolAntiPattern.connectionCount = 0;
  }
}

/**
 * ✅ วิธีแก้: เก็บ "Promise ของการสร้าง instance" แทนการเช็ค instance ตรง ๆ
 * เพราะ caller ทุกคนที่มาถึงพร้อมกันจะได้ Promise เดียวกัน (memoized) ไป await ต่อ
 * รับประกันว่า connect() จะถูกเรียกแค่ครั้งเดียวไม่ว่าจะมี concurrent caller กี่ตัว
 */
class ConnectionPool {
  private static instancePromise: Promise<ConnectionPool> | undefined;
  static connectionCount = 0;

  private constructor(public readonly id: number) {}

  private static async connect(): Promise<ConnectionPool> {
    await new Promise((resolve) => setTimeout(resolve, 20));
    ConnectionPool.connectionCount += 1;
    return new ConnectionPool(ConnectionPool.connectionCount);
  }

  static getInstance(): Promise<ConnectionPool> {
    // การเรียก connect() เกิดขึ้นแค่ครั้งแรกที่ instancePromise ยังไม่ถูกตั้งค่า
    // การเรียกครั้งถัดไป (แม้จะ "แข่งกันมา" ก่อน promise แรก resolve) ก็ได้ promise เดิม
    if (!ConnectionPool.instancePromise) {
      ConnectionPool.instancePromise = ConnectionPool.connect();
    }
    return ConnectionPool.instancePromise;
  }

  static resetForTesting(): void {
    ConnectionPool.instancePromise = undefined;
    ConnectionPool.connectionCount = 0;
  }
}

// ===========================================================================
// (3) DI-friendly alternative: ไม่ใช้ static getInstance() แบบ hardcode
// ===========================================================================
// แนวคิด: ให้ "ความเป็น singleton" เป็นเรื่องของการ compose ตอน bootstrap แอป
// (สร้าง instance เดียว แล้วแจกจ่ายผ่าน constructor injection) ไม่ใช่ฝังไว้ในตัว class เอง
// ข้อดี: เทสง่ายกว่ามาก เพราะสร้าง instance ใหม่แยกกันได้ในแต่ละเทสเคส โดยไม่ต้อง reset
// static state ใด ๆ, และ class ไม่ได้ผูกติดกับ "วิธีเข้าถึง" ของมันเอง

class AppConfigService {
  constructor(private readonly config: AppConfig) {}

  get(): AppConfig {
    return this.config;
  }
}

/** จำลอง composition root ของแอป — ที่เดียวที่ตัดสินใจว่าจะมี config instance กี่ตัว */
function bootstrapApp(): { configService: AppConfigService } {
  const config: AppConfig = {
    appName: process.env.APP_NAME ?? 'architecture-beginner',
    port: Number(process.env.PORT ?? 3000),
    databaseUrl: process.env.DATABASE_URL ?? 'mysql://localhost:3306/app',
  };
  // instance เดียวถูกสร้างที่นี่ แล้ว "แจก" ไปให้ทุกส่วนที่ต้องใช้ config ผ่าน DI
  const configService = new AppConfigService(config);
  return { configService };
}

// ===========================================================================
// Demo
// ===========================================================================

async function runDemo(): Promise<void> {
  console.log('--- (1) Classic lazy singleton: ConfigManager ---');
  const cfgA = ConfigManager.getInstance();
  const cfgB = ConfigManager.getInstance();
  console.log('Same instance?', cfgA === cfgB);
  console.log('Load count (should stay 1 even after 2 getInstance calls):', cfgA.getLoadCount());
  console.log('Config:', cfgA.get());

  console.log('\n--- (2) ❌ Anti-pattern: async lazy singleton race condition ---');
  ConnectionPoolAntiPattern.resetForTesting();
  const [p1, p2, p3] = await Promise.all([
    ConnectionPoolAntiPattern.getInstance(),
    ConnectionPoolAntiPattern.getInstance(),
    ConnectionPoolAntiPattern.getInstance(),
  ]);
  console.log(
    `connectionCount = ${ConnectionPoolAntiPattern.connectionCount} (ควรเป็น 1 แต่กลับเป็นมากกว่านั้น!)`,
  );
  console.log('Same instance across 3 concurrent calls?', p1 === p2 && p2 === p3);

  console.log('\n--- (2) ✅ Fixed: memoized-promise singleton ---');
  ConnectionPool.resetForTesting();
  const [q1, q2, q3] = await Promise.all([
    ConnectionPool.getInstance(),
    ConnectionPool.getInstance(),
    ConnectionPool.getInstance(),
  ]);
  console.log(`connectionCount = ${ConnectionPool.connectionCount} (ถูกต้อง: ต้องเป็น 1 เสมอ)`);
  console.log('Same instance across 3 concurrent calls?', q1 === q2 && q2 === q3);

  console.log('\n--- (3) DI-friendly alternative (no static getInstance) ---');
  const { configService } = bootstrapApp();
  console.log('Config via DI:', configService.get());
  console.log(
    'สังเกต: ในเทส เราสร้าง AppConfigService(mockConfig) แยกกันได้ทุกเทสเคส ' +
      'โดยไม่ต้องยุ่งกับ static state หรือ resetForTesting() เลย',
  );
}

const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  runDemo();
}

export { ConfigManager, ConnectionPoolAntiPattern, ConnectionPool, AppConfigService, bootstrapApp };
export type { AppConfig };
