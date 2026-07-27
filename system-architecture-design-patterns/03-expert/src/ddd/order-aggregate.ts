/**
 * Domain-Driven Design — Order Aggregate (Ordering Bounded Context)
 *
 * This file is intentionally self-contained (it does not reuse the
 * clean-architecture/ module) so it can be read top-to-bottom as a single
 * example of DDD building blocks:
 *
 * - Value Objects : Money, Address   (immutable, compared by value)
 * - Entities  : OrderLine     (has identity within the aggregate)
 * - Aggregate Root : Order      (the ONLY door into the aggregate)
 * - Domain Events : OrderCreated, OrderPlaced, ... (facts the aggregate raises)
 * - Invariants  : rules the aggregate enforces on every mutation
 *
 * Ubiquitous Language used here matches how a real merchandising/ordering
 * team at an e-commerce company would talk: "Order", "Line", "Place",
 * "Cancel", "Shipping Address" — not generic CRUD words like "Row" or "Update".
 *
 * Run: npx tsx ddd/order-aggregate.ts
 */

// ===========================================================================
// Domain error
// ===========================================================================
export class OrderInvariantViolation extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OrderInvariantViolation';
  }
}

// ===========================================================================
// Value Objects — no identity, immutable, equality by value
// ===========================================================================
export class Money {
  private constructor(
    private readonly minorUnits: number,
    private readonly currency: string,
  ) {}

  static of(minorUnits: number, currency: string): Money {
    if (!Number.isInteger(minorUnits) || minorUnits < 0) {
      throw new OrderInvariantViolation('Money must be a non-negative integer of minor units');
    }
    return new Money(minorUnits, currency.toUpperCase());
  }

  static zero(currency: string): Money {
    return Money.of(0, currency);
  }

  add(other: Money): Money {
    this.assertSameCurrency(other);
    return Money.of(this.minorUnits + other.minorUnits, this.currency);
  }

  subtract(other: Money): Money {
    this.assertSameCurrency(other);
    if (other.minorUnits > this.minorUnits) {
      throw new OrderInvariantViolation('Cannot subtract to a negative Money amount');
    }
    return Money.of(this.minorUnits - other.minorUnits, this.currency);
  }

  multiply(factor: number): Money {
    return Money.of(Math.round(this.minorUnits * factor), this.currency);
  }

  isLessThan(other: Money): boolean {
    this.assertSameCurrency(other);
    return this.minorUnits < other.minorUnits;
  }

  equals(other: Money): boolean {
    return this.minorUnits === other.minorUnits && this.currency === other.currency;
  }

  get amount(): number {
    return this.minorUnits;
  }

  get isoCurrency(): string {
    return this.currency;
  }

  toString(): string {
    return `${(this.minorUnits / 100).toFixed(2)} ${this.currency}`;
  }

  private assertSameCurrency(other: Money): void {
    if (this.currency !== other.currency) {
      throw new OrderInvariantViolation(`Currency mismatch: ${this.currency} vs ${other.currency}`);
    }
  }
}

export interface AddressProps {
  line1: string;
  city: string;
  postalCode: string;
  country: string; // ISO-3166 alpha-2, e.g. "TH"
}

export class Address {
  private constructor(
    readonly line1: string,
    readonly city: string,
    readonly postalCode: string,
    readonly country: string,
  ) {}

  static create(props: AddressProps): Address {
    if (!props.line1.trim()) throw new OrderInvariantViolation('Address line1 is required');
    if (!props.city.trim()) throw new OrderInvariantViolation('Address city is required');
    if (!/^[A-Z]{2}$/.test(props.country)) {
      throw new OrderInvariantViolation(
        'Address country must be an ISO-3166 alpha-2 code, e.g. TH',
      );
    }
    return new Address(
      props.line1.trim(),
      props.city.trim(),
      props.postalCode.trim(),
      props.country,
    );
  }

  equals(other: Address): boolean {
    return (
      this.line1 === other.line1 &&
      this.city === other.city &&
      this.postalCode === other.postalCode &&
      this.country === other.country
    );
  }

  toString(): string {
    return `${this.line1}, ${this.city} ${this.postalCode}, ${this.country}`;
  }
}

// ===========================================================================
// Domain Events — immutable facts the aggregate raises when its state
// changes. Published after a successful transaction commit in real systems
// (transactional outbox), consumed by other Bounded Contexts or read models.
// ===========================================================================
export interface DomainEvent {
  readonly type: string;
  readonly occurredAt: Date;
  readonly orderId: string;
}

export class OrderCreated implements DomainEvent {
  readonly type = 'OrderCreated';
  readonly occurredAt = new Date();
  constructor(
    readonly orderId: string,
    readonly customerId: string,
  ) {}
}

export class OrderLineAdded implements DomainEvent {
  readonly type = 'OrderLineAdded';
  readonly occurredAt = new Date();
  constructor(
    readonly orderId: string,
    readonly productId: string,
    readonly quantity: number,
  ) {}
}

export class ShippingAddressAssigned implements DomainEvent {
  readonly type = 'ShippingAddressAssigned';
  readonly occurredAt = new Date();
  constructor(
    readonly orderId: string,
    readonly address: string,
  ) {}
}

export class OrderPlaced implements DomainEvent {
  readonly type = 'OrderPlaced';
  readonly occurredAt = new Date();
  constructor(
    readonly orderId: string,
    readonly totalMinorUnits: number,
    readonly currency: string,
  ) {}
}

export class OrderCancelled implements DomainEvent {
  readonly type = 'OrderCancelled';
  readonly occurredAt = new Date();
  constructor(
    readonly orderId: string,
    readonly reason: string,
  ) {}
}

// ===========================================================================
// Entity — OrderLine has identity (lineId) within the aggregate, but no
// lifecycle or repository of its own: it is only ever loaded/saved through
// the Order aggregate root.
// ===========================================================================
export interface OrderLineProps {
  lineId: string;
  productId: string;
  unitPrice: Money;
  quantity: number;
}

export class OrderLine {
  readonly lineId: string;
  readonly productId: string;
  readonly unitPrice: Money;
  private quantity: number;

  constructor(props: OrderLineProps) {
    if (props.quantity <= 0 || !Number.isInteger(props.quantity)) {
      throw new OrderInvariantViolation('OrderLine quantity must be a positive integer');
    }
    this.lineId = props.lineId;
    this.productId = props.productId;
    this.unitPrice = props.unitPrice;
    this.quantity = props.quantity;
  }

  changeQuantity(next: number): void {
    if (next <= 0 || !Number.isInteger(next)) {
      throw new OrderInvariantViolation('OrderLine quantity must be a positive integer');
    }
    this.quantity = next;
  }

  getQuantity(): number {
    return this.quantity;
  }

  lineTotal(): Money {
    return this.unitPrice.multiply(this.quantity);
  }
}

// ===========================================================================
// Aggregate Root — Order
//
// Aggregate boundary rule: everything inside (lines) is only reachable via
// the root. External code NEVER holds a reference to an OrderLine and
// mutates it directly — every mutation goes through an Order method so the
// aggregate can enforce its invariants atomically and raise domain events.
//
// Invariants enforced here:
// 1. A line can only be added while the order is in DRAFT status.
// 2. An order cannot exceed MAX_LINES distinct product lines (basket cap).
// 3. Placing requires a shipping address AND at least one line AND a
//  total >= MINIMUM_ORDER_VALUE.
// 4. Only a PLACED order can be cancelled; cancelling a SHIPPED order is
//  a different, explicitly-modeled process (returns), not a plain cancel.
// ===========================================================================
export enum OrderStatus {
  Draft = 'DRAFT',
  Placed = 'PLACED',
  Cancelled = 'CANCELLED',
}

const MAX_LINES = 50;

export class Order {
  private readonly lines = new Map<string, OrderLine>();
  private shippingAddress: Address | undefined;
  private status: OrderStatus = OrderStatus.Draft;
  private readonly pendingEvents: DomainEvent[] = [];
  private readonly minimumOrderValue: Money;

  private constructor(
    readonly orderId: string,
    readonly customerId: string,
    private readonly currency: string,
  ) {
    this.minimumOrderValue = Money.of(2000, currency); // e.g. 20.00 THB minimum basket
  }

  static create(orderId: string, customerId: string, currency: string): Order {
    const order = new Order(orderId, customerId, currency);
    order.raise(new OrderCreated(orderId, customerId));
    return order;
  }

  addLine(props: { lineId: string; productId: string; unitPrice: Money; quantity: number }): void {
    this.assertStatus(OrderStatus.Draft, 'add a line');
    if (this.lines.size >= MAX_LINES && !this.lines.has(props.lineId)) {
      throw new OrderInvariantViolation(`Order cannot exceed ${MAX_LINES} distinct lines`);
    }
    const existing = this.lines.get(props.lineId);
    if (existing) {
      existing.changeQuantity(existing.getQuantity() + props.quantity);
    } else {
      this.lines.set(props.lineId, new OrderLine(props));
    }
    this.raise(new OrderLineAdded(this.orderId, props.productId, props.quantity));
  }

  assignShippingAddress(address: Address): void {
    this.assertStatus(OrderStatus.Draft, 'assign a shipping address');
    this.shippingAddress = address;
    this.raise(new ShippingAddressAssigned(this.orderId, address.toString()));
  }

  place(): void {
    this.assertStatus(OrderStatus.Draft, 'place the order');
    if (this.lines.size === 0) {
      throw new OrderInvariantViolation('Cannot place an order with no lines');
    }
    if (!this.shippingAddress) {
      throw new OrderInvariantViolation('Cannot place an order without a shipping address');
    }
    const total = this.total();
    if (total.isLessThan(this.minimumOrderValue)) {
      throw new OrderInvariantViolation(
        `Order total ${total.toString()} is below the minimum order value ${this.minimumOrderValue.toString()}`,
      );
    }
    this.status = OrderStatus.Placed;
    this.raise(new OrderPlaced(this.orderId, total.amount, total.isoCurrency));
  }

  cancel(reason: string): void {
    this.assertStatus(OrderStatus.Placed, 'cancel the order');
    this.status = OrderStatus.Cancelled;
    this.raise(new OrderCancelled(this.orderId, reason));
  }

  total(): Money {
    let sum = Money.zero(this.currency);
    for (const line of this.lines.values()) {
      sum = sum.add(line.lineTotal());
    }
    return sum;
  }

  getStatus(): OrderStatus {
    return this.status;
  }

  getLines(): readonly OrderLine[] {
    return [...this.lines.values()];
  }

  /** Drains and returns events accumulated since the last pull — the pattern used to feed an outbox/event bus. */
  pullDomainEvents(): DomainEvent[] {
    const events = [...this.pendingEvents];
    this.pendingEvents.length = 0;
    return events;
  }

  private raise(event: DomainEvent): void {
    this.pendingEvents.push(event);
  }

  private assertStatus(expected: OrderStatus, action: string): void {
    if (this.status !== expected) {
      throw new OrderInvariantViolation(
        `Cannot ${action}: order is in status ${this.status}, expected ${expected}`,
      );
    }
  }
}

// ===========================================================================
// Demo
// ===========================================================================
function main(): void {
  console.log('=== DDD demo: Order aggregate lifecycle ===\n');

  const order = Order.create('order-9001', 'cust-042', 'THB');

  order.addLine({
    lineId: 'line-1',
    productId: 'sku-som-tam',
    unitPrice: Money.of(6000, 'THB'),
    quantity: 2,
  });
  order.addLine({
    lineId: 'line-2',
    productId: 'sku-tom-yum',
    unitPrice: Money.of(9000, 'THB'),
    quantity: 1,
  });
  order.assignShippingAddress(
    Address.create({
      line1: '99/1 Sukhumvit Rd',
      city: 'Bangkok',
      postalCode: '10110',
      country: 'TH',
    }),
  );
  order.place();

  console.log(`Order status : ${order.getStatus()}`);
  console.log(`Order total : ${order.total().toString()}`);
  console.log('Domain events raised:');
  for (const event of order.pullDomainEvents()) {
    console.log(` - [${event.occurredAt.toISOString()}] ${event.type}`);
  }

  console.log('\n=== Invariant violation: placing an order below the minimum value ===\n');
  try {
    const tinyOrder = Order.create('order-9002', 'cust-043', 'THB');
    tinyOrder.addLine({
      lineId: 'line-1',
      productId: 'sku-chewing-gum',
      unitPrice: Money.of(500, 'THB'),
      quantity: 1,
    });
    tinyOrder.assignShippingAddress(
      Address.create({ line1: '1 Silom Rd', city: 'Bangkok', postalCode: '10500', country: 'TH' }),
    );
    tinyOrder.place();
  } catch (err) {
    if (err instanceof OrderInvariantViolation) {
      console.log(`Rejected as expected: ${err.message}`);
    } else {
      throw err;
    }
  }

  console.log('\n=== Cancelling a placed order ===\n');
  order.cancel('Customer changed their mind');
  console.log(`Order status : ${order.getStatus()}`);
  for (const event of order.pullDomainEvents()) {
    console.log(
      ` - [${event.occurredAt.toISOString()}] ${event.type} (reason: ${(event as OrderCancelled).reason})`,
    );
  }
}

const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  main();
}
