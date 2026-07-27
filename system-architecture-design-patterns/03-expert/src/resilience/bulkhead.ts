/**
 * Bulkhead — isolates concurrency per dependency (like watertight
 * compartments in a ship's hull) so that one slow/overloaded downstream
 * cannot exhaust the caller's entire thread/connection pool and starve
 * calls to OTHER, healthy dependencies.
 *
 * Implemented here as a semaphore with a bounded wait queue: at most
 * `maxConcurrent` calls run at once; extra calls queue up to `maxQueueSize`;
 * beyond that, calls are rejected immediately (fail fast, don't queue
 * forever and build up latency/memory).
 */

export class BulkheadRejectedError extends Error {
  constructor(name: string) {
    super(`Bulkhead "${name}" is full — both concurrency slots and queue are exhausted`);
    this.name = 'BulkheadRejectedError';
  }
}

export interface BulkheadOptions {
  readonly name: string;
  readonly maxConcurrent: number;
  readonly maxQueueSize: number;
}

interface QueueEntry {
  resolve: () => void;
}

export class Bulkhead {
  private active = 0;
  private readonly queue: QueueEntry[] = [];

  constructor(private readonly options: BulkheadOptions) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }

  stats(): { active: number; queued: number } {
    return { active: this.active, queued: this.queue.length };
  }

  private acquire(): Promise<void> {
    if (this.active < this.options.maxConcurrent) {
      this.active += 1;
      return Promise.resolve();
    }
    if (this.queue.length >= this.options.maxQueueSize) {
      throw new BulkheadRejectedError(this.options.name);
    }
    return new Promise<void>((resolve) => {
      this.queue.push({ resolve });
    });
  }

  private release(): void {
    const next = this.queue.shift();
    if (next) {
      // Hand the freed slot directly to the next queued caller (still counts as active).
      next.resolve();
    } else {
      this.active -= 1;
    }
  }
}
