/**
 * CQRS + Event Sourcing demo.
 *
 * Flow: PlaceOrder command journey → events appended to the store →
 * projection updates its read model → we query the read model (not the
 * write model) to answer "what does this order look like right now?".
 *
 * Run: npx tsx cqrs-event-sourcing/index.ts
 */
import { OrderCommand } from './commands.js';
import { EventStore } from './event-store.js';
import { CommandRejected, OrderCommandHandler } from './order-command-handler.js';
import { OrderSummaryProjection } from './order-projection.js';

async function main(): Promise<void> {
  const store = new EventStore();
  const projection = new OrderSummaryProjection(store); // subscribes immediately
  const handler = new OrderCommandHandler(store);

  const orderId = 'order-es-0001';

  console.log('=== CQRS + Event Sourcing demo ===\n');

  const commands: OrderCommand[] = [
    { type: 'CreateOrder', orderId, customerId: 'cust-777', currency: 'THB' },
    {
      type: 'AddItem',
      orderId,
      productId: 'sku-khao-soi',
      unitPriceMinorUnits: 12000,
      quantity: 2,
    },
    {
      type: 'AddItem',
      orderId,
      productId: 'sku-thai-milk-tea',
      unitPriceMinorUnits: 5500,
      quantity: 1,
    },
    { type: 'PlaceOrder', orderId },
  ];

  for (const command of commands) {
    await handler.handle(command);
    console.log(`Handled command: ${command.type}`);
  }

  console.log('\n--- Raw event stream (write model / source of truth) ---');
  for (const event of store.load(orderId)) {
    console.log(
      ` v${event.version} ${event.type}`,
      JSON.stringify(event, (key, value) => (key === 'occurredAt' ? undefined : value)),
    );
  }

  console.log('\n--- Read model built by the projection (query side) ---');
  console.log(projection.getById(orderId));

  console.log('\n=== Rejecting a command that violates the current state ===\n');
  try {
    await handler.handle({
      type: 'AddItem',
      orderId,
      productId: 'sku-extra',
      unitPriceMinorUnits: 1000,
      quantity: 1,
    });
  } catch (err) {
    if (err instanceof CommandRejected) {
      console.log(`Rejected as expected: ${err.message}`);
    } else {
      throw err;
    }
  }

  console.log(
    '\n=== Rebuilding the projection from scratch (proves read model is a disposable cache) ===\n',
  );
  const freshProjection = new OrderSummaryProjection(store);
  freshProjection.replay(store.loadAll());
  console.log(
    'Rebuilt read model matches the live one:',
    JSON.stringify(freshProjection.getById(orderId)) ===
      JSON.stringify(projection.getById(orderId)),
  );
  console.log(`Orders currently PLACED: ${projection.listByStatus('PLACED').length}`);
}

const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  main().catch((err) => {
    console.error('Fatal error in demo:', err);
    process.exitCode = 1;
  });
}
