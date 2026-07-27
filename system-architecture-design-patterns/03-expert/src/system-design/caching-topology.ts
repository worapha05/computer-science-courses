/**
 * Caching topologies — simulated against an in-memory "database" so the
 * read/write path and consistency trade-offs of each strategy are visible
 * in the console output rather than left abstract.
 */

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class SimulatedDatabase {
  private readonly rows = new Map<string, string>();
  public readLatencyMs = 40;
  public writeLatencyMs = 40;

  async get(key: string): Promise<string | undefined> {
    await delay(this.readLatencyMs);
    return this.rows.get(key);
  }

  async put(key: string, value: string): Promise<void> {
    await delay(this.writeLatencyMs);
    this.rows.set(key, value);
  }
}

class SimulatedCache {
  private readonly entries = new Map<string, string>();
  public latencyMs = 2;

  async get(key: string): Promise<string | undefined> {
    await delay(this.latencyMs);
    return this.entries.get(key);
  }

  async set(key: string, value: string): Promise<void> {
    await delay(this.latencyMs);
    this.entries.set(key, value);
  }

  async invalidate(key: string): Promise<void> {
    await delay(this.latencyMs);
    this.entries.delete(key);
  }

  has(key: string): boolean {
    return this.entries.has(key);
  }
}

/**
 * Cache-Aside (a.k.a. Lazy Loading): the application checks the cache first;
 * on a miss, it reads the database and populates the cache. Writes go
 * straight to the database and INVALIDATE (not update) the cache entry —
 * simplest and most common pattern; can serve a stale value for the brief
 * window between a write and the next read repopulating the cache.
 */
export class CacheAsideStore {
  constructor(
    private readonly db: SimulatedDatabase,
    private readonly cache: SimulatedCache,
  ) {}

  async read(key: string): Promise<{ value: string | undefined; source: 'cache' | 'db' }> {
    const cached = await this.cache.get(key);
    if (cached !== undefined) return { value: cached, source: 'cache' };
    const value = await this.db.get(key);
    if (value !== undefined) await this.cache.set(key, value);
    return { value, source: 'db' };
  }

  async write(key: string, value: string): Promise<void> {
    await this.db.put(key, value);
    await this.cache.invalidate(key); // next read will repopulate from the DB
  }
}

/**
 * Write-Through: writes go to the cache AND the database synchronously, in
 * the same request. Reads are always served from the cache and are never
 * stale relative to the last completed write — at the cost of every write
 * paying the database's write latency inline.
 */
export class WriteThroughStore {
  constructor(
    private readonly db: SimulatedDatabase,
    private readonly cache: SimulatedCache,
  ) {}

  async read(key: string): Promise<{ value: string | undefined; source: 'cache' | 'db' }> {
    const cached = await this.cache.get(key);
    if (cached !== undefined) return { value: cached, source: 'cache' };
    const value = await this.db.get(key);
    if (value !== undefined) await this.cache.set(key, value);
    return { value, source: 'db' };
  }

  async write(key: string, value: string): Promise<void> {
    await this.db.put(key, value);
    await this.cache.set(key, value); // cache immediately reflects the new value
  }
}

/**
 * Write-Behind (Write-Back): writes go to the cache immediately and are
 * ACKed to the caller right away; the database write is buffered and
 * flushed asynchronously (batched/coalesced). Lowest write latency, highest
 * throughput — but a crash before the flush loses the buffered write, so
 * this trades durability for latency. Good fit for high-frequency counters
 * (view counts, leaderboards) where an occasional lost increment is fine.
 */
export class WriteBehindStore {
  private readonly buffer = new Map<string, string>();
  private flushTimer: ReturnType<typeof setInterval> | undefined;

  constructor(
    private readonly db: SimulatedDatabase,
    private readonly cache: SimulatedCache,
    private readonly flushIntervalMs = 50,
  ) {}

  start(): void {
    this.flushTimer = setInterval(() => void this.flush(), this.flushIntervalMs);
  }

  stop(): void {
    if (this.flushTimer) clearInterval(this.flushTimer);
  }

  async read(key: string): Promise<{ value: string | undefined; source: 'cache' | 'db' }> {
    const cached = await this.cache.get(key);
    if (cached !== undefined) return { value: cached, source: 'cache' };
    const value = await this.db.get(key);
    return { value, source: 'db' };
  }

  async write(key: string, value: string): Promise<void> {
    await this.cache.set(key, value); // acknowledged immediately
    this.buffer.set(key, value); // queued for the DB
  }

  async flush(): Promise<void> {
    const pending = [...this.buffer.entries()];
    this.buffer.clear();
    await Promise.all(pending.map(([key, value]) => this.db.put(key, value)));
    if (pending.length > 0) {
      console.log(` [write-behind] flushed ${pending.length} buffered write(s) to the database`);
    }
  }
}

export async function demoCachingTopologies(): Promise<void> {
  console.log('=== Caching topologies ===\n');

  console.log('--- Cache-Aside ---');
  {
    const db = new SimulatedDatabase();
    const cache = new SimulatedCache();
    const store = new CacheAsideStore(db, cache);
    await db.put('product:1', 'Mango Sticky Rice');

    const miss = await store.read('product:1');
    console.log(` first read -> source=${miss.source}, value=${miss.value}`);
    const hit = await store.read('product:1');
    console.log(
      ` second read -> source=${hit.source}, value=${hit.value} (served from cache, no DB hit)`,
    );

    await store.write('product:1', 'Mango Sticky Rice (Limited Edition)');
    console.log(
      ` cache after write: has entry = ${cache.has('product:1')} (invalidated, not updated)`,
    );
    const afterWrite = await store.read('product:1');
    console.log(` read after write -> source=${afterWrite.source}, value=${afterWrite.value}`);
  }

  console.log('\n--- Write-Through ---');
  {
    const db = new SimulatedDatabase();
    const cache = new SimulatedCache();
    const store = new WriteThroughStore(db, cache);

    await store.write('product:2', 'Tom Yum Kit');
    console.log(` cache after write: has entry = ${cache.has('product:2')} (updated immediately)`);
    const read = await store.read('product:2');
    console.log(` read -> source=${read.source}, value=${read.value} (always fresh)`);
  }

  console.log('\n--- Write-Behind ---');
  {
    const db = new SimulatedDatabase();
    const cache = new SimulatedCache();
    const store = new WriteBehindStore(db, cache, 30);
    store.start();

    await store.write('counter:page-views', '1');
    await store.write('counter:page-views', '2');
    await store.write('counter:page-views', '3');
    console.log(' wrote 3 updates almost instantly (cache-only, DB not touched yet)');
    console.log(` DB value immediately after writes: ${await db.get('counter:page-views')}`);

    await delay(60); // let the flush interval fire
    console.log(` DB value after flush interval: ${await db.get('counter:page-views')}`);
    store.stop();
  }
}
