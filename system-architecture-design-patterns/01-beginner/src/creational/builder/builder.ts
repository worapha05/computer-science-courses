/**
 * Creational Pattern — Builder
 * ================================================
 * เจตนา: แยกขั้นตอน "การสร้าง object ที่ซับซ้อน" ออกจากตัว object เอง
 * ทำให้สร้าง object แบบ step-by-step ด้วย fluent API ที่อ่านง่าย และป้องกัน
 * ปัญหา "constructor รับ parameter เยอะเกินไป" (telescoping constructor problem)
 *
 * เลือกใช้ Builder เมื่อ:
 * - object มี optional field จำนวนมาก และการันตี "สถานะที่ valid" ตอนสร้างเสร็จยาก
 * - ต้องการ fluent/chainable API ที่อ่านออกมาเหมือนภาษาธรรมดา (readable DSL)
 * - อยาก reuse ขั้นตอนการสร้างบางส่วนร่วมกัน (เช่น base request แล้วแตกไปแต่ละ endpoint)
 *
 * ตัวอย่างนี้: 2 กรณีใช้งานจริงที่เจอบ่อย
 * 1) HttpRequestBuilder — สร้าง HTTP request object (method, headers, query, body)
 * 2) SqlQueryBuilder — สร้าง SQL SELECT query แบบ fluent
 */

// ===========================================================================
// (1) HttpRequestBuilder
// ===========================================================================

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

interface HttpRequest {
  readonly method: HttpMethod;
  readonly url: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly queryParams: Readonly<Record<string, string>>;
  readonly body: unknown;
  readonly timeoutMs: number;
}

/**
 * ปัญหาที่ builder แก้: ถ้าไม่มี builder เราต้องเขียน constructor ที่รับ
 * (method, url, headers, queryParams, body, timeoutMs) พร้อมกันหมด หรือใช้
 * object literal ตรง ๆ ที่ไม่มีการ validate/normalize ระหว่างทาง
 */
class HttpRequestBuilder {
  private method: HttpMethod = 'GET';
  private readonly headers: Record<string, string> = {};
  private readonly queryParams: Record<string, string> = {};
  private body: unknown = undefined;
  private timeoutMs = 5000;

  constructor(private readonly url: string) {}

  setMethod(method: HttpMethod): this {
    this.method = method;
    return this;
  }

  addHeader(key: string, value: string): this {
    this.headers[key] = value;
    return this;
  }

  addQueryParam(key: string, value: string): this {
    this.queryParams[key] = value;
    return this;
  }

  setJsonBody(payload: unknown): this {
    this.body = payload;
    this.headers['Content-Type'] = 'application/json';
    return this;
  }

  setTimeout(ms: number): this {
    if (ms <= 0) {
      throw new Error('Timeout must be a positive number of milliseconds');
    }
    this.timeoutMs = ms;
    return this;
  }

  /** build() คือจุดที่ validate ความครบถ้วน/ความสมเหตุสมผลก่อนคืน object ที่ immutable */
  build(): HttpRequest {
    if (!this.url.startsWith('http')) {
      throw new Error(`Invalid URL: "${this.url}" must start with http/https`);
    }
    return {
      method: this.method,
      url: this.url,
      headers: { ...this.headers },
      queryParams: { ...this.queryParams },
      body: this.body,
      timeoutMs: this.timeoutMs,
    };
  }
}

function toQueryString(params: Readonly<Record<string, string>>): string {
  const entries = Object.entries(params);
  if (entries.length === 0) return '';
  return (
    '?' + entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&')
  );
}

function describeHttpRequest(request: HttpRequest): string {
  const fullUrl = request.url + toQueryString(request.queryParams);
  const headerLines = Object.entries(request.headers)
    .map(([k, v]) => ` ${k}: ${v}`)
    .join('\n');
  return [
    `${request.method} ${fullUrl} (timeout: ${request.timeoutMs}ms)`,
    headerLines,
    request.body ? `Body: ${JSON.stringify(request.body)}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

// ===========================================================================
// (2) SqlQueryBuilder — fluent DSL สำหรับสร้าง SELECT query
// ===========================================================================

class SqlQueryBuilder {
  private readonly selectedColumns: string[] = ['*'];
  private fromTable = '';
  private readonly whereClauses: string[] = [];
  private orderByColumn: string | undefined;
  private orderDirection: 'ASC' | 'DESC' = 'ASC';
  private limitCount: number | undefined;

  select(...columns: string[]): this {
    this.selectedColumns.length = 0;
    this.selectedColumns.push(...columns);
    return this;
  }

  from(table: string): this {
    this.fromTable = table;
    return this;
  }

  where(condition: string): this {
    this.whereClauses.push(condition);
    return this;
  }

  orderBy(column: string, direction: 'ASC' | 'DESC' = 'ASC'): this {
    this.orderByColumn = column;
    this.orderDirection = direction;
    return this;
  }

  limit(count: number): this {
    if (count <= 0) {
      throw new Error('LIMIT must be a positive integer');
    }
    this.limitCount = count;
    return this;
  }

  /** build() ประกอบ SQL string จริง พร้อม validate ว่ามี FROM table แล้วหรือยัง */
  build(): string {
    if (!this.fromTable) {
      throw new Error('SqlQueryBuilder: FROM table is required — call .from(table) before build()');
    }

    const parts = [`SELECT ${this.selectedColumns.join(', ')}`, `FROM ${this.fromTable}`];

    if (this.whereClauses.length > 0) {
      parts.push(`WHERE ${this.whereClauses.join(' AND ')}`);
    }
    if (this.orderByColumn) {
      parts.push(`ORDER BY ${this.orderByColumn} ${this.orderDirection}`);
    }
    if (this.limitCount !== undefined) {
      parts.push(`LIMIT ${this.limitCount}`);
    }

    return parts.join('\n');
  }
}

// ===========================================================================
// Demo
// ===========================================================================

function runDemo(): void {
  console.log('--- (1) HttpRequestBuilder ---');
  const request = new HttpRequestBuilder('https://api.example.com/orders')
    .setMethod('POST')
    .addHeader('Authorization', 'Bearer <token>')
    .addQueryParam('source', 'mobile-app')
    .setJsonBody({ productId: 'SKU-42', quantity: 2 })
    .setTimeout(8000)
    .build();
  console.log(describeHttpRequest(request));

  console.log('\n--- (1) Reusing a partial builder for multiple requests ---');
  const baseBuilder = () =>
    new HttpRequestBuilder('https://api.example.com/health').addHeader(
      'X-Client',
      'architecture-beginner',
    );
  console.log(describeHttpRequest(baseBuilder().setMethod('GET').build()));
  console.log(
    describeHttpRequest(baseBuilder().setMethod('POST').setJsonBody({ ping: true }).build()),
  );

  console.log('\n--- (2) SqlQueryBuilder ---');
  const query = new SqlQueryBuilder()
    .select('id', 'customer_name', 'total')
    .from('orders')
    .where("status = 'PAID'")
    .where('total > 1000')
    .orderBy('created_at', 'DESC')
    .limit(20)
    .build();
  console.log(query);

  console.log('\n--- (2) Validation: forgetting FROM throws immediately ---');
  try {
    new SqlQueryBuilder().select('id').build();
  } catch (err) {
    console.log(`❌ Caught expected error: ${(err as Error).message}`);
  }

  console.log(
    '\nสังเกต: ทั้งสอง builder ใช้ fluent chaining (return this) เพื่อให้อ่านออกมาเป็นลำดับขั้นตอน ' +
      'ที่ชัดเจน และ validate ความถูกต้องรวมไว้ที่ build() จุดเดียว แทนการกระจาย validation ' +
      'ไปทั่วโค้ดที่เรียกใช้',
  );
}

const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  runDemo();
}

export { HttpRequestBuilder, SqlQueryBuilder, describeHttpRequest };
export type { HttpRequest, HttpMethod };
