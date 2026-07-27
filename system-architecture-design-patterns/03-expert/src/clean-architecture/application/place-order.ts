/**
 * Application layer — Use Cases (Application Business Rules)
 *
 * Depends ONLY on the domain layer's types (entities/value-objects) and on
 * abstract ports it declares itself (OrderRepository, IdGenerator, Clock).
 * It knows nothing about HTTP, databases, or frameworks — those are outer
 * rings that must depend inward on these interfaces (the Dependency Rule).
 */
import { Order, OrderItem } from '../domain/entities.js';
import { CustomerId, Money, OrderId, ProductId, Quantity } from '../domain/value-objects.js';

/** Port (output boundary) — implemented by infrastructure, never by application itself. */
export interface OrderRepository {
  nextId(): OrderId;
  save(order: Order): Promise<void>;
  findById(id: OrderId): Promise<Order | undefined>;
}

export interface PlaceOrderItemInput {
  productId: string;
  unitPriceMinorUnits: number;
  currency: string;
  quantity: number;
}

export interface PlaceOrderInput {
  customerId: string;
  currency: string;
  items: PlaceOrderItemInput[];
}

export interface PlaceOrderOutput {
  orderId: string;
  totalMinorUnits: number;
  currency: string;
  itemCount: number;
}

/** Raised for business-rule failures that the interface layer should map to 4xx, not 5xx. */
export class UseCaseValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UseCaseValidationError';
  }
}

/**
 * PlaceOrderUseCase orchestrates the domain to fulfil one application-level
 * intent: "a customer places an order". It contains no business rule itself
 * (those live in Order/OrderItem) — only coordination and translation between
 * primitive DTOs and rich domain objects.
 */
export class PlaceOrderUseCase {
  constructor(private readonly orderRepository: OrderRepository) {}

  async execute(input: PlaceOrderInput): Promise<PlaceOrderOutput> {
    if (input.items.length === 0) {
      throw new UseCaseValidationError('An order requires at least one item');
    }

    const orderId = this.orderRepository.nextId();
    const customerId = CustomerId.create(input.customerId);
    const order = Order.create({ id: orderId, customerId, currency: input.currency });

    for (const line of input.items) {
      const item = new OrderItem({
        productId: ProductId.create(line.productId),
        unitPrice: Money.of(line.unitPriceMinorUnits, line.currency),
        quantity: Quantity.of(line.quantity),
      });
      order.addItem(item);
    }

    order.place();
    await this.orderRepository.save(order);

    return {
      orderId: order.id.toString(),
      totalMinorUnits: order.total().minorUnits,
      currency: order.total().isoCurrency,
      itemCount: order.getItems().length,
    };
  }
}
