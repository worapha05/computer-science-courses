/**
 * Composition Root — the ONLY file allowed to know about every layer at
 * once. It wires concrete infrastructure into abstract application ports,
 * which is how dependencies end up pointing inward (toward domain) even
 * though control flow at runtime points outward (HTTP -> use case -> repo).
 *
 *   ┌────────────────────────────────────────────┐
 *   │    domain (core)    │ <- no outward deps
 *   │  entities.ts / value-objects.ts  │
 *   └───────────────────▲──────────────────────────┘
 *        │ depends on
 *   ┌───────────────────┴──────────────────────────┐
 *   │    application (use cases)   │
 *   │ place-order.ts + OrderRepository port  │
 *   └───────────────────▲──────────────────────────┘
 *    implements port │   │ calls
 *   ┌───────────────────┴───┐ ┌─────┴─────────────┐
 *   │  infrastructure  │ │  interface  │
 *   │ in-memory-order-repo.ts │ │ http-handler.ts  │
 *   └─────────────────────────┘ └──────────────────────┘
 *
 * Run: npx tsx clean-architecture/index.ts
 */
import { PlaceOrderUseCase } from './application/place-order.js';
import { InMemoryOrderRepository } from './infrastructure/in-memory-order-repo.js';
import { OrderHttpHandler, SimulatedHttpRequest } from './interface/http-handler.js';

async function main(): Promise<void> {
  const orderRepository = new InMemoryOrderRepository();
  const placeOrderUseCase = new PlaceOrderUseCase(orderRepository);
  const httpHandler = new OrderHttpHandler(placeOrderUseCase);

  console.log('=== Clean Architecture demo: POST /orders ===\n');

  const validRequest: SimulatedHttpRequest = {
    body: {
      customerId: 'cust-001',
      currency: 'THB',
      items: [
        {
          productId: 'sku-mango-sticky-rice',
          unitPriceMinorUnits: 8500,
          currency: 'THB',
          quantity: 2,
        },
        { productId: 'sku-thai-iced-tea', unitPriceMinorUnits: 4500, currency: 'THB', quantity: 1 },
      ],
    },
  };

  const successResponse = await httpHandler.handlePlaceOrder(validRequest);
  console.log('Request:', JSON.stringify(validRequest.body, null, 2));
  console.log('Response:', JSON.stringify(successResponse, null, 2));

  console.log('\n=== Same use case, but violating a domain invariant (empty order) ===\n');

  const invalidRequest: SimulatedHttpRequest = {
    body: { customerId: 'cust-002', currency: 'THB', items: [] },
  };
  const errorResponse = await httpHandler.handlePlaceOrder(invalidRequest);
  console.log('Response:', JSON.stringify(errorResponse, null, 2));

  console.log(`\nOrders persisted in repository: ${orderRepository.size()}`);
}

const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  main().catch((err) => {
    console.error('Fatal error in demo:', err);
    process.exitCode = 1;
  });
}
