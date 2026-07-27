/**
 * CQRS — Commands (the "C" side).
 *
 * Commands are imperative, named in the present tense ("PlaceOrder"), can
 * be rejected, and produce zero or more events when accepted. They are
 * handled by exactly one handler — unlike events, which can have many
 * subscribers.
 */

export interface CreateOrder {
  readonly type: 'CreateOrder';
  readonly orderId: string;
  readonly customerId: string;
  readonly currency: string;
}

export interface AddItem {
  readonly type: 'AddItem';
  readonly orderId: string;
  readonly productId: string;
  readonly unitPriceMinorUnits: number;
  readonly quantity: number;
}

export interface PlaceOrder {
  readonly type: 'PlaceOrder';
  readonly orderId: string;
}

export interface CancelOrder {
  readonly type: 'CancelOrder';
  readonly orderId: string;
  readonly reason: string;
}

export type OrderCommand = CreateOrder | AddItem | PlaceOrder | CancelOrder;
