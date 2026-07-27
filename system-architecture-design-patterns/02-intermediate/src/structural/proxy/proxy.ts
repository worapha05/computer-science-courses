/**
 * PROXY PATTERN — Caching + Authorization Proxy for a Data Service
 * ----------------------------------------------------------------
 * TH: Proxy implement interface เดียวกับ "real subject" แต่ควบคุมการเข้าถึง
 *  มันก่อน เช่น lazy-load, cache, ตรวจสิทธิ์, log, throttle โดยที่ caller
 *  เรียกผ่าน interface เดิม ไม่รู้ว่ามี proxy คั่นอยู่
 * EN: A Proxy implements the same interface as the real subject but controls
 *  access to it — lazy loading, caching, authorization, logging, throttling
 *  — while the caller is unaware a proxy sits in front.
 *
 * ความแตกต่างกับ Decorator:
 * TH: Decorator เน้น "เพิ่มความสามารถ" (add behavior) ส่วน Proxy เน้น
 *  "ควบคุมการเข้าถึง" (control access) ตัว object จริง โครงสร้างโค้ดคล้ายกันมาก
 *  แต่ "เจตนา" (intent) ต่างกัน — Proxy อาจปฏิเสธการเรียกไปยัง real subject
 *  เลยก็ได้ (เช่น ไม่มีสิทธิ์), Decorator มักจะเรียก wrapped เสมอ
 * EN: Decorator's intent is "add behavior"; Proxy's intent is "control access".
 *  Structurally similar, but a Proxy may refuse to call the real subject at
 *  all (e.g. unauthorized), whereas a Decorator normally always delegates.
 *
 * รันตัวอย่าง / Run:
 * npx tsx structural/proxy/proxy.ts
 */

// ============================================================================
// 1) SUBJECT INTERFACE
// ============================================================================

export interface Report {
  id: string;
  title: string;
  confidential: boolean;
  content: string;
}

export interface ReportService {
  getReport(id: string, requesterRole: 'admin' | 'manager' | 'guest'): Report;
}

// ============================================================================
// 2) REAL SUBJECT — "หนัก" สมมติว่าเป็น query ฐานข้อมูล/สร้างรายงานที่แพง
// ============================================================================

export class RealReportService implements ReportService {
  private readonly db: Record<string, Report> = {
    'rpt-1': {
      id: 'rpt-1',
      title: 'Q1 Sales Summary',
      confidential: false,
      content: 'Sales grew 12%...',
    },
    'rpt-2': {
      id: 'rpt-2',
      title: 'Executive Salary Report',
      confidential: true,
      content: 'CEO comp: ...',
    },
  };

  getReport(id: string): Report {
    console.log(` [RealReportService] EXPENSIVE query building report "${id}" from DB...`);
    const report = this.db[id];
    if (!report) throw new Error(`Report ${id} not found`);
    return report;
  }
}

// ============================================================================
// 3) PROTECTION PROXY — ตรวจสิทธิ์ก่อนถึง real subject
// ============================================================================

export class AuthorizationProxy implements ReportService {
  constructor(private readonly realService: ReportService) {}

  getReport(id: string, requesterRole: 'admin' | 'manager' | 'guest'): Report {
    console.log(` [AuthorizationProxy] checking access for role="${requesterRole}" on "${id}"`);

    // TH: ต้องรู้ว่ารายงานเป็น confidential หรือไม่ก่อนตัดสิน — แต่การเช็คนี้
    //  ควรทำแบบ "ถูก" (metadata) ไม่ใช่ query เต็มที่แพง หรือในระบบจริงอาจมี
    //  metadata store แยกจาก content store
    // EN: ideally uses cheap metadata, not the expensive full fetch, in real systems.
    const isConfidential = id === 'rpt-2'; // จำลอง metadata lookup แบบถูก

    if (isConfidential && requesterRole === 'guest') {
      throw new Error(`Access denied: guest cannot view confidential report "${id}"`);
    }

    return this.realService.getReport(id, requesterRole);
  }
}

// ============================================================================
// 4) CACHING PROXY — ห่อ AuthorizationProxy อีกชั้น ลดโหลด real subject
// ============================================================================

export class CachingReportProxy implements ReportService {
  private readonly cache = new Map<string, Report>();

  constructor(private readonly wrapped: ReportService) {}

  getReport(id: string, requesterRole: 'admin' | 'manager' | 'guest'): Report {
    const cacheKey = `${id}:${requesterRole}`; // TH: cache key ต้องรวม role ด้วย ไม่งั้น leak สิทธิ์!
    const cached = this.cache.get(cacheKey);
    if (cached) {
      console.log(` [CachingReportProxy] cache HIT for ${cacheKey}`);
      return cached;
    }
    console.log(` [CachingReportProxy] cache MISS for ${cacheKey}`);
    const report = this.wrapped.getReport(id, requesterRole);
    this.cache.set(cacheKey, report);
    return report;
  }
}

// ============================================================================
// 5) LAZY VIRTUAL PROXY — ตัวอย่างที่สอง: lazy-load รูปภาพขนาดใหญ่
// ============================================================================

export interface Image {
  render(): void;
}

export class HighResolutionImage implements Image {
  private pixels: string;

  constructor(private readonly path: string) {
    // TH: การโหลดไฟล์จริง "แพง" — เกิดขึ้นตอนสร้าง RealSubject เท่านั้น
    console.log(` [HighResolutionImage] loading heavy file from disk: ${path}`);
    this.pixels = `<${path} bytes...>`;
  }

  render(): void {
    console.log(` [HighResolutionImage] rendering ${this.path} (${this.pixels.length} bytes)`);
  }
}

/** TH: Virtual Proxy — เลื่อนการสร้าง object หนักออกไปจนกว่าจะถูกใช้จริง (render ครั้งแรก)
 * EN: Virtual Proxy — defers creating the expensive object until first real use */
export class LazyImageProxy implements Image {
  private realImage: HighResolutionImage | null = null;

  constructor(private readonly path: string) {
    console.log(` [LazyImageProxy] created placeholder for ${path} (no disk I/O yet)`);
  }

  render(): void {
    if (!this.realImage) {
      this.realImage = new HighResolutionImage(this.path);
    }
    this.realImage.render();
  }
}

// ============================================================================
// DEMO
// ============================================================================

function demoAuthAndCache() {
  console.log('== Proxy Pattern: Authorization + Caching over ReportService ==\n');

  const service: ReportService = new CachingReportProxy(
    new AuthorizationProxy(new RealReportService()),
  );

  console.log('--- Manager requests public report (miss) ---');
  console.log(service.getReport('rpt-1', 'manager').title);

  console.log('\n--- Manager requests same report again (should HIT cache) ---');
  console.log(service.getReport('rpt-1', 'manager').title);

  console.log('\n--- Guest tries confidential report (should be denied, no DB hit) ---');
  try {
    service.getReport('rpt-2', 'guest');
  } catch (err) {
    console.log(` Denied as expected: ${(err as Error).message}`);
  }

  console.log('\n--- Admin requests confidential report (allowed) ---');
  console.log(service.getReport('rpt-2', 'admin').title);
}

function demoLazyImage() {
  console.log('\n\n== Proxy Pattern: Lazy Virtual Proxy for Images ==\n');

  console.log('--- Creating gallery of 2 image proxies (no disk I/O yet) ---');
  const gallery: Image[] = [
    new LazyImageProxy('/photos/vacation.jpg'),
    new LazyImageProxy('/photos/wedding.jpg'),
  ];

  console.log('\n--- Only rendering the first image (only it triggers disk I/O) ---');
  gallery[0]?.render();

  console.log('\n--- Rendering it again (already loaded, no disk I/O this time) ---');
  gallery[0]?.render();
}

const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  demoAuthAndCache();
  demoLazyImage();
}
