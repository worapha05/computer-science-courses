/**
 * DECORATOR PATTERN — HTTP Client with Logging / Retry / Cache layers
 * ----------------------------------------------------------------
 * TH: Decorator เพิ่มความสามารถให้ object ทีละชั้น "ตอน runtime" โดยไม่ต้องแก้
 *  class เดิมและไม่ต้องสร้าง subclass ผสมทุก combination (LoggingRetryCache,
 *  RetryCache, LoggingCache, ...) ซึ่งจะระเบิดจำนวน class แบบ inheritance
 * EN: Decorator adds behavior to an object at runtime by wrapping it, avoiding
 *  a combinatorial explosion of subclasses for every feature combination.
 *
 * กฎสำคัญ: ทุก decorator ต้อง implement interface เดียวกับ object ที่มันหุ้ม
 * (เรียกว่า "transparent wrapping") เพื่อให้ผู้เรียกใช้แยกไม่ออกว่าเป็นของแท้
 * หรือถูกหุ้มกี่ชั้น
 *
 * รันตัวอย่าง / Run:
 * npx tsx structural/decorator/decorator.ts
 */

// ============================================================================
// 1) COMPONENT INTERFACE — สัญญาที่ core object และทุก decorator ต้อง implement
// ============================================================================

export interface HttpResponse<T = unknown> {
  status: number;
  body: T;
}

export interface HttpClient {
  get<T>(url: string): Promise<HttpResponse<T>>;
}

// ============================================================================
// 2) CONCRETE COMPONENT — ของแท้ (ยิง network จริง ในตัวอย่างนี้ mock ไว้)
// ============================================================================

export class RealHttpClient implements HttpClient {
  private readonly attemptsPerUrl = new Map<string, number>();

  async get<T>(url: string): Promise<HttpResponse<T>> {
    const attempt = (this.attemptsPerUrl.get(url) ?? 0) + 1;
    this.attemptsPerUrl.set(url, attempt);
    console.log(` [RealHttpClient] GET ${url} (attempt #${attempt} for this URL)`);

    // TH: จำลอง flaky network — attempt แรกของแต่ละ URL ล้มเหลวเสมอ เพื่อโชว์ Retry
    // EN: simulate a flaky network — the first attempt per URL always fails,
    //  so the Retry decorator has something real to recover from
    if (attempt === 1) {
      throw new Error(`Network error calling ${url}`);
    }

    await new Promise((r) => setTimeout(r, 10));
    return { status: 200, body: { url, fetchedAt: Date.now() } as unknown as T };
  }
}

// ============================================================================
// 3) BASE DECORATOR — เก็บ reference ของ component ที่ถูกหุ้ม
// ============================================================================

abstract class HttpClientDecorator implements HttpClient {
  protected constructor(protected readonly wrapped: HttpClient) {}

  abstract get<T>(url: string): Promise<HttpResponse<T>>;
}

// ============================================================================
// 4) CONCRETE DECORATORS
// ============================================================================

/** TH: เพิ่ม logging รอบการเรียก โดยไม่แก้ RealHttpClient เลย
 * EN: adds structured logging around each call without touching RealHttpClient */
export class LoggingDecorator extends HttpClientDecorator {
  constructor(wrapped: HttpClient) {
    super(wrapped);
  }

  async get<T>(url: string): Promise<HttpResponse<T>> {
    const start = Date.now();
    console.log(` [LoggingDecorator] -> GET ${url}`);
    try {
      const res = await this.wrapped.get<T>(url);
      console.log(` [LoggingDecorator] <- ${res.status} (${Date.now() - start}ms)`);
      return res;
    } catch (err) {
      console.log(
        ` [LoggingDecorator] <- ERROR ${(err as Error).message} (${Date.now() - start}ms)`,
      );
      throw err;
    }
  }
}

/** TH: retry แบบ exponential backoff เมื่อเจอ error — โปร่งใสต่อ caller
 * EN: exponential-backoff retry on failure — transparent to the caller */
export class RetryDecorator extends HttpClientDecorator {
  constructor(
    wrapped: HttpClient,
    private readonly maxAttempts = 3,
    private readonly baseDelayMs = 20,
  ) {
    super(wrapped);
  }

  async get<T>(url: string): Promise<HttpResponse<T>> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
      try {
        return await this.wrapped.get<T>(url);
      } catch (err) {
        lastError = err;
        console.log(
          ` [RetryDecorator] attempt ${attempt}/${this.maxAttempts} failed: ${(err as Error).message}`,
        );
        if (attempt < this.maxAttempts) {
          await new Promise((r) => setTimeout(r, this.baseDelayMs * 2 ** (attempt - 1)));
        }
      }
    }
    throw lastError;
  }
}

/** TH: cache แบบ in-memory ตาม URL พร้อม TTL — ลด load ปลายทาง
 * EN: in-memory TTL cache keyed by URL — reduces load on the upstream */
export class CacheDecorator extends HttpClientDecorator {
  private readonly cache = new Map<string, { response: HttpResponse; expiresAt: number }>();

  constructor(
    wrapped: HttpClient,
    private readonly ttlMs = 5000,
  ) {
    super(wrapped);
  }

  async get<T>(url: string): Promise<HttpResponse<T>> {
    const cached = this.cache.get(url);
    if (cached && cached.expiresAt > Date.now()) {
      console.log(` [CacheDecorator] HIT ${url}`);
      return cached.response as HttpResponse<T>;
    }
    console.log(` [CacheDecorator] MISS ${url}`);
    const res = await this.wrapped.get<T>(url);
    this.cache.set(url, { response: res, expiresAt: Date.now() + this.ttlMs });
    return res;
  }
}

// ============================================================================
// DEMO — เลือกลำดับการหุ้มได้ตามความต้องการ (order matters!)
// TH: ลำดับสำคัญ — cache ควรอยู่ "นอก" retry (ไม่ retry สิ่งที่ hit cache แล้ว)
//  ส่วน logging ควรอยู่ "นอกสุด" เพื่อเห็นภาพรวม end-to-end
// ============================================================================

async function demo() {
  console.log('== Decorator Pattern: RealHttpClient + Logging + Retry + Cache ==\n');

  const real = new RealHttpClient();
  const client: HttpClient = new LoggingDecorator(new CacheDecorator(new RetryDecorator(real)));

  console.log('--- Call 1: /users/1 (miss -> fetch, ล้มเหลวรอบแรกแล้ว retry สำเร็จ) ---');
  await client.get('/users/1');

  console.log('\n--- Call 2: /users/1 อีกครั้ง (ควร HIT cache ไม่ยิง network) ---');
  await client.get('/users/1');

  console.log('\n--- Call 3: /users/2 (URL ใหม่ -> miss อีกครั้ง) ---');
  await client.get('/users/2');
}

const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  demo();
}
