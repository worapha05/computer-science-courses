/**
 * Domain layer — Entities (Enterprise Business Rules)
 *
 * The Order entity owns its invariants. No use case, controller, or repository
 * is allowed to put an Order into an invalid state — the constructor/methods
 * are the only gate. This is the innermost ring of Clean Architecture, so it
 * has ZERO imports from application/infrastructure/interface.
 */
import { CustomerId, DomainError, Money, OrderId, ProductId, Quantity } from './value-objects.js';

export enum OrderStatus {
  Draft = 'DRAFT',
  Placed = 'PLACED',
  Cancelled = 'CANCELLED',
}

export interface OrderItemProps {
  productId: ProductId;
  unitPrice: Money;
  quantity: Quantity;
}

/** OrderItem is an entity local to the Order aggregate — no independent lifecycle outside it. */
export class OrderItem {
  readonly productId: ProductId;
  readonly unitPrice: Money;
  readonly quantity: Quantity;

  constructor(props: OrderItemProps) {
    this.productId = props.productId;
    this.unitPrice = props.unitPrice;
    this.quantity = props.quantity;
  }

  lineTotal(): Money {
    return this.unitPrice.multiply(this.quantity.raw);
  }
}

export interface OrderProps {
  id: OrderId;
  customerId: CustomerId;
  currency: string;
}

/**
 * Order — the Entity/Aggregate root of the mini order domain used to
 * demonstrate Clean Architecture's dependency rule. (A richer version with
 * domain events and stricter aggregate boundaries lives in ../../ddd.)
 */
export class Order {
  private readonly items: OrderItem[] = [];
  private status: OrderStatus = OrderStatus.Draft;
  readonly createdAt: Date;

  private constructor(
    readonly id: OrderId,
    readonly customerId: CustomerId,
    private readonly currency: string,
  ) {
    this.createdAt = new Date();
  }

  static create(props: OrderProps): Order {
    return new Order(props.id, props.customerId, props.currency);
  }

  addItem(item: OrderItem): void {
    if (this.status !== OrderStatus.Draft) {
      throw new DomainError('Cannot modify items after the order has been placed');
    }
    if (item.unitPrice.isoCurrency !== this.currency) {
      throw new DomainError('Item currency does not match order currency');
    }
    this.items.push(item);
  }

  /** Placing an order is the transition guarded by the domain's core invariant. */
  place(): void {
    if (this.status !== OrderStatus.Draft) {
      throw new DomainError(`Order cannot be placed from status ${this.status}`);
    }
    if (this.items.length === 0) {
      throw new DomainError('Cannot place an order with zero items');
    }
    if (this.total().minorUnits <= 0) {
      throw new DomainError('Cannot place an order with a zero total');
    }
    this.status = OrderStatus.Placed;
  }

  cancel(): void {
    if (this.status !== OrderStatus.Placed) {
      throw new DomainError(`Only a placed order can be cancelled, current status: ${this.status}`);
    }
    this.status = OrderStatus.Cancelled;
  }

  total(): Money {
    return this.items.reduce((sum, item) => sum.add(item.lineTotal()), Money.zero(this.currency));
  }

  getStatus(): OrderStatus {
    return this.status;
  }

  getItems(): readonly OrderItem[] {
    return this.items;
  }
}
