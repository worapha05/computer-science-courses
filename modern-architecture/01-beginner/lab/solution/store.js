/**
 * External store — source of truth ของออเดอร์ (จำลอง DB)
 */
import { createMemoryStore } from '../../lib/http.js';

export const catalog = [
  { id: 'p1', name: 'Clean Architecture', category: 'books', price: 890 },
  { id: 'p2', name: 'Mechanical Keyboard', category: 'gadgets', price: 2590 },
  { id: 'p3', name: 'Domain-Driven Design', category: 'books', price: 1200 },
  { id: 'p4', name: 'USB-C Hub', category: 'gadgets', price: 990 },
];

export const orderStore = createMemoryStore();
