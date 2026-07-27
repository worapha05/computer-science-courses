/**
 * Event Sourcing — Domain Events for the Order stream.
 *
 * Every event is:
 * - immutable once written (the event store is append-only)
 * - versioned (its position in the stream — used for optimistic concurrency)
 * - named in the past tense (a fact that already happened, not a request)
 *
 * The union of all events for a stream IS the source of truth. Any read
 * model (projection) is a derived, disposable, rebuildable cache.
 */

interface BaseEvent {
  readonly orderId: string;
  readonly version: number;
  readonly occurredAt: Date;
}

export interface OrderCreated extends BaseEvent {
  readonly type: 'OrderCreated';
  readonly customerId: string;
  readonly currency: string;
}

export interface ItemAdded extends BaseEvent {
  readonly type: 'ItemAdded';
  readonly productId: string;
  readonly unitPriceMinorUnits: number;
  readonly quantity: number;
}

export interface OrderPlaced extends BaseEvent {
  readonly type: 'OrderPlaced';
  readonly totalMinorUnits: number;
}

export interface OrderCancelled extends BaseEvent {
  readonly type: 'OrderCancelled';
  readonly reason: string;
}

export type OrderEvent = OrderCreated | ItemAdded | OrderPlaced | OrderCancelled;
