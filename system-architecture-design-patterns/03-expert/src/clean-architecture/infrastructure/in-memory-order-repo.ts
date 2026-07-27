/**
 * Infrastructure layer — implements the OrderRepository port declared by the
 * application layer. This is where a real project would swap in Postgres,
 * DynamoDB, etc. The application/domain layers never import this file —
 * only `index.ts` (the composition root) wires it in.
 */
import { Order } from '../domain/entities.js';
import { OrderId } from '../domain/value-objects.js';
import { OrderRepository } from '../application/place-order.js';

export class InMemoryOrderRepository implements OrderRepository {
  private readonly store = new Map<string, Order>();
  private sequence = 0;

  nextId(): OrderId {
    this.sequence += 1;
    return OrderId.create(`order-${this.sequence.toString().padStart(6, '0')}`);
  }

  async save(order: Order): Promise<void> {
    // Simulates async I/O latency of a real datastore driver.
    await Promise.resolve();
    this.store.set(order.id.toString(), order);
  }

  async findById(id: OrderId): Promise<Order | undefined> {
    await Promise.resolve();
    return this.store.get(id.toString());
  }

  size(): number {
    return this.store.size;
  }
}
