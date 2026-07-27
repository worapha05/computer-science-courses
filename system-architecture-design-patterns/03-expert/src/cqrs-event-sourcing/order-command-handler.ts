/**
 * CQRS write side — the command handler rehydrates aggregate state by
 * folding the event stream (never by reading a "current state" table),
 * validates the command against that state, and appends new events.
 *
 * This is the essence of Event Sourcing: state = reduce(events, initialState).
 * There is no mutable "orders" table on the write side — only the log.
 */
import { AddItem, CancelOrder, CreateOrder, OrderCommand, PlaceOrder } from './commands.js';
import { ConcurrencyError, EventStore } from './event-store.js';
import { OrderEvent } from './events.js';

export class CommandRejected extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CommandRejected';
  }
}

type OrderStatus = 'NONE' | 'DRAFT' | 'PLACED' | 'CANCELLED';

interface OrderItemState {
  unitPriceMinorUnits: number;
  quantity: number;
}

interface OrderState {
  status: OrderStatus;
  currency: string;
  items: Map<string, OrderItemState>;
}

function initialState(): OrderState {
  return { status: 'NONE', currency: '', items: new Map() };
}

/** Pure reducer — the single place that knows how each event affects state. Easy to unit test in isolation. */
function fold(state: OrderState, event: OrderEvent): OrderState {
  switch (event.type) {
    case 'OrderCreated':
      return { status: 'DRAFT', currency: event.currency, items: new Map() };
    case 'ItemAdded': {
      const items = new Map(state.items);
      const existing = items.get(event.productId);
      items.set(event.productId, {
        unitPriceMinorUnits: event.unitPriceMinorUnits,
        quantity: (existing?.quantity ?? 0) + event.quantity,
      });
      return { ...state, items };
    }
    case 'OrderPlaced':
      return { ...state, status: 'PLACED' };
    case 'OrderCancelled':
      return { ...state, status: 'CANCELLED' };
  }
}

function rehydrate(events: readonly OrderEvent[]): OrderState {
  return events.reduce(fold, initialState());
}

function computeTotal(state: OrderState): number {
  let total = 0;
  for (const item of state.items.values()) {
    total += item.unitPriceMinorUnits * item.quantity;
  }
  return total;
}

export class OrderCommandHandler {
  constructor(private readonly store: EventStore) {}

  async handle(command: OrderCommand): Promise<void> {
    const streamId = command.orderId;
    const history = this.store.load(streamId);
    const state = rehydrate(history);
    const expectedVersion = history.length;

    const newEvents = this.decide(command, state, expectedVersion);

    try {
      this.store.append(streamId, expectedVersion, newEvents);
    } catch (err) {
      if (err instanceof ConcurrencyError) {
        // In a real system: reload + re-decide + retry a bounded number of times.
        throw err;
      }
      throw err;
    }
  }

  private decide(command: OrderCommand, state: OrderState, version: number): OrderEvent[] {
    const occurredAt = new Date();

    switch (command.type) {
      case 'CreateOrder':
        return this.decideCreateOrder(command, state, version, occurredAt);
      case 'AddItem':
        return this.decideAddItem(command, state, version, occurredAt);
      case 'PlaceOrder':
        return this.decidePlaceOrder(command, state, version, occurredAt);
      case 'CancelOrder':
        return this.decideCancelOrder(command, state, version, occurredAt);
    }
  }

  private decideCreateOrder(
    cmd: CreateOrder,
    state: OrderState,
    version: number,
    occurredAt: Date,
  ): OrderEvent[] {
    if (state.status !== 'NONE') {
      throw new CommandRejected(`Order ${cmd.orderId} already exists`);
    }
    return [
      {
        type: 'OrderCreated',
        orderId: cmd.orderId,
        version: version + 1,
        occurredAt,
        customerId: cmd.customerId,
        currency: cmd.currency,
      },
    ];
  }

  private decideAddItem(
    cmd: AddItem,
    state: OrderState,
    version: number,
    occurredAt: Date,
  ): OrderEvent[] {
    if (state.status !== 'DRAFT') {
      throw new CommandRejected(
        `Cannot add items to order ${cmd.orderId} in status ${state.status}`,
      );
    }
    if (cmd.quantity <= 0) {
      throw new CommandRejected('Quantity must be positive');
    }
    return [
      {
        type: 'ItemAdded',
        orderId: cmd.orderId,
        version: version + 1,
        occurredAt,
        productId: cmd.productId,
        unitPriceMinorUnits: cmd.unitPriceMinorUnits,
        quantity: cmd.quantity,
      },
    ];
  }

  private decidePlaceOrder(
    cmd: PlaceOrder,
    state: OrderState,
    version: number,
    occurredAt: Date,
  ): OrderEvent[] {
    if (state.status !== 'DRAFT') {
      throw new CommandRejected(`Cannot place order ${cmd.orderId} in status ${state.status}`);
    }
    if (state.items.size === 0) {
      throw new CommandRejected(`Cannot place order ${cmd.orderId} with zero items`);
    }
    return [
      {
        type: 'OrderPlaced',
        orderId: cmd.orderId,
        version: version + 1,
        occurredAt,
        totalMinorUnits: computeTotal(state),
      },
    ];
  }

  private decideCancelOrder(
    cmd: CancelOrder,
    state: OrderState,
    version: number,
    occurredAt: Date,
  ): OrderEvent[] {
    if (state.status !== 'PLACED') {
      throw new CommandRejected(`Cannot cancel order ${cmd.orderId} in status ${state.status}`);
    }
    return [
      {
        type: 'OrderCancelled',
        orderId: cmd.orderId,
        version: version + 1,
        occurredAt,
        reason: cmd.reason,
      },
    ];
  }
}
