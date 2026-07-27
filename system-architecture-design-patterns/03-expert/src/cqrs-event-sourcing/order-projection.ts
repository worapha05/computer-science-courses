/**
 * CQRS read side — a Projection subscribes to the event stream and
 * maintains a denormalized, query-optimized read model. It is entirely
 * disposable: if you delete it and replay `EventStore.loadAll()`, it comes
 * back byte-for-byte identical. This is what "read models are just cache"
 * means in CQRS/ES.
 *
 * Consistency model: this projection updates synchronously right after
 * `append()` in this demo (single process). In production the write and
 * read sides usually live in different services/datastores connected by a
 * message broker, which makes the read model EVENTUALLY consistent —
 * callers must be designed to tolerate a short replication lag (e.g. via
 * "read-your-own-write" hints, polling, or optimistic UI).
 */
import { EventStore } from './event-store.js';
import { OrderEvent } from './events.js';

export interface OrderSummaryReadModel {
  orderId: string;
  customerId: string;
  currency: string;
  status: 'DRAFT' | 'PLACED' | 'CANCELLED';
  itemCount: number;
  totalMinorUnits: number;
  updatedAt: Date;
}

export class OrderSummaryProjection {
  private readonly readModel = new Map<string, OrderSummaryReadModel>();

  constructor(store: EventStore) {
    store.subscribe((streamId, event) => this.apply(streamId, event));
  }

  private apply(orderId: string, event: OrderEvent): void {
    switch (event.type) {
      case 'OrderCreated':
        this.readModel.set(orderId, {
          orderId,
          customerId: event.customerId,
          currency: event.currency,
          status: 'DRAFT',
          itemCount: 0,
          totalMinorUnits: 0,
          updatedAt: event.occurredAt,
        });
        return;
      case 'ItemAdded': {
        const current = this.mustGet(orderId);
        this.readModel.set(orderId, {
          ...current,
          itemCount: current.itemCount + event.quantity,
          totalMinorUnits: current.totalMinorUnits + event.unitPriceMinorUnits * event.quantity,
          updatedAt: event.occurredAt,
        });
        return;
      }
      case 'OrderPlaced': {
        const current = this.mustGet(orderId);
        this.readModel.set(orderId, { ...current, status: 'PLACED', updatedAt: event.occurredAt });
        return;
      }
      case 'OrderCancelled': {
        const current = this.mustGet(orderId);
        this.readModel.set(orderId, {
          ...current,
          status: 'CANCELLED',
          updatedAt: event.occurredAt,
        });
        return;
      }
    }
  }

  /** Rebuilds this projection from a full event log — proves the read model is a disposable, replayable cache. */
  replay(events: readonly OrderEvent[]): void {
    this.readModel.clear();
    for (const event of events) {
      this.apply(event.orderId, event);
    }
  }

  getById(orderId: string): OrderSummaryReadModel | undefined {
    return this.readModel.get(orderId);
  }

  listByStatus(status: OrderSummaryReadModel['status']): OrderSummaryReadModel[] {
    return [...this.readModel.values()].filter((row) => row.status === status);
  }

  private mustGet(orderId: string): OrderSummaryReadModel {
    const current = this.readModel.get(orderId);
    if (!current) throw new Error(`Projection out of sync: no read model row for order ${orderId}`);
    return current;
  }
}
