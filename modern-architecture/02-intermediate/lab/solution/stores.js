import { createMemoryStore } from '../../lib/http.js';

export const restaurantsDb = createMemoryStore();
export const ordersDb = createMemoryStore();
export const paymentsDb = createMemoryStore();

export const orderQueue = [];

await restaurantsDb.set('r1', {
  id: 'r1',
  name: 'Noodle House',
  menu: ['Pad Thai', 'Boat Noodles'],
});
await restaurantsDb.set('r2', {
  id: 'r2',
  name: 'Green Curry Co',
  menu: ['Green Curry', 'Mango Sticky Rice'],
});
