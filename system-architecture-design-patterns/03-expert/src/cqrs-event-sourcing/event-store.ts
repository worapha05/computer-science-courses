/**
 * A minimal append-only Event Store with optimistic concurrency control and
 * a publish hook for projections. Real implementations (EventStoreDB,
 * Kafka + compacted topics, Postgres with an `events` table + `SELECT ...
 * FOR UPDATE`) all share this same contract.
 */
import { OrderEvent } from './events.js';

export class ConcurrencyError extends Error {
  constructor(streamId: string, expectedVersion: number, actualVersion: number) {
    super(
      `Concurrency conflict on stream "${streamId}": expected version ${expectedVersion}, but stream is at ${actualVersion}. ` +
        `Reload the aggregate and retry the command.`,
    );
    this.name = 'ConcurrencyError';
  }
}

export type EventSubscriber = (streamId: string, event: OrderEvent) => void;

export class EventStore {
  private readonly streams = new Map<string, OrderEvent[]>();
  private readonly subscribers: EventSubscriber[] = [];

  /**
   * Appends events atomically iff the stream is exactly at `expectedVersion`
   * (0 = stream does not exist yet). This is how event-sourced systems get
   * write consistency without locking the whole aggregate table.
   */
  append(streamId: string, expectedVersion: number, events: readonly OrderEvent[]): void {
    const existing = this.streams.get(streamId) ?? [];
    if (existing.length !== expectedVersion) {
      throw new ConcurrencyError(streamId, expectedVersion, existing.length);
    }
    const next = [...existing, ...events];
    this.streams.set(streamId, next);
    for (const event of events) {
      for (const subscriber of this.subscribers) {
        subscriber(streamId, event);
      }
    }
  }

  load(streamId: string): readonly OrderEvent[] {
    return this.streams.get(streamId) ?? [];
  }

  currentVersion(streamId: string): number {
    return this.streams.get(streamId)?.length ?? 0;
  }

  /** All events across all streams, in global append order — useful for rebuilding projections from scratch. */
  loadAll(): readonly OrderEvent[] {
    return [...this.streams.values()]
      .flat()
      .sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime());
  }

  subscribe(subscriber: EventSubscriber): void {
    this.subscribers.push(subscriber);
  }
}
