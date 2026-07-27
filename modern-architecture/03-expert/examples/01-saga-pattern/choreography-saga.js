/**
 * Choreography Saga — แต่ละบริการฟัง event แล้วตัดสินใจเอง
 */
import {
  reserveInventory,
  releaseInventory,
  chargePayment,
  refundPayment,
  arrangeShipping,
  cancelShipping,
  snapshot,
} from './services.js';
import { log } from '../../lib/http.js';

const bus = [];

function publish(type, payload) {
  bus.push({ type, payload, at: Date.now() });
  log('info', 'event', { type, orderId: payload.orderId });
}

const handlers = {
  async OrderCreated({ orderId, sku, qty, amount }) {
    try {
      await reserveInventory(orderId, sku, qty);
      publish('InventoryReserved', { orderId, sku, qty, amount });
    } catch (err) {
      publish('OrderCancelled', { orderId, reason: err.message });
    }
  },

  async InventoryReserved({ orderId, sku, qty, amount }) {
    try {
      await chargePayment(orderId, amount);
      publish('PaymentCaptured', { orderId, sku, qty, amount });
    } catch (err) {
      await releaseInventory(orderId, sku, qty);
      publish('OrderCancelled', { orderId, reason: err.message });
    }
  },

  async PaymentCaptured({ orderId, sku, qty }) {
    try {
      await arrangeShipping(orderId);
      publish('OrderCompleted', { orderId });
    } catch (err) {
      await refundPayment(orderId);
      await releaseInventory(orderId, sku, qty);
      publish('OrderCancelled', { orderId, reason: err.message });
    }
  },

  async OrderCompleted({ orderId }) {
    log('info', 'choreography.done', { orderId });
  },

  async OrderCancelled({ orderId, reason }) {
    log('warn', 'choreography.cancelled', { orderId, reason });
  },
};

async function drain() {
  while (bus.length) {
    const evt = bus.shift();
    const fn = handlers[evt.type];
    if (fn) await fn(evt.payload);
  }
}

publish('OrderCreated', { orderId: 'CH-1', sku: 'SKU-1', qty: 1, amount: 400 });
await drain();

publish('OrderCreated', { orderId: 'CH-2', sku: 'SKU-2', qty: 1, amount: 400 });
await drain();

console.log('final state:', snapshot());
