/**
 * Interface Adapters layer — translates the outside world (HTTP) into calls
 * on a use case, and translates use case results/errors back into an HTTP
 * shape. In a real app this file would be an Express/Fastify controller;
 * here we simulate the request/response objects to keep the example
 * runnable with zero dependencies.
 */
import {
  PlaceOrderInput,
  type PlaceOrderItemInput,
  PlaceOrderUseCase,
  UseCaseValidationError,
} from '../application/place-order.js';
import { DomainError } from '../domain/value-objects.js';

export interface SimulatedHttpRequest {
  body: unknown;
}

export interface SimulatedHttpResponse {
  status: number;
  body: Record<string, unknown>;
}

function isPlaceOrderItem(item: unknown): item is PlaceOrderItemInput {
  if (typeof item !== 'object' || item === null) return false;
  const c = item as Record<string, unknown>;
  return (
    typeof c.productId === 'string' &&
    typeof c.unitPriceMinorUnits === 'number' &&
    typeof c.currency === 'string' &&
    typeof c.quantity === 'number'
  );
}

function isPlaceOrderInput(body: unknown): body is PlaceOrderInput {
  if (typeof body !== 'object' || body === null) return false;
  const candidate = body as Record<string, unknown>;
  if (
    typeof candidate.customerId !== 'string' ||
    typeof candidate.currency !== 'string' ||
    !Array.isArray(candidate.items)
  ) {
    return false;
  }
  return candidate.items.every((item) => isPlaceOrderItem(item));
}

/** Controller — depends inward on the use case, never the other way around. */
export class OrderHttpHandler {
  constructor(private readonly placeOrder: PlaceOrderUseCase) {}

  async handlePlaceOrder(req: SimulatedHttpRequest): Promise<SimulatedHttpResponse> {
    if (!isPlaceOrderInput(req.body)) {
      return { status: 400, body: { error: 'Malformed request body' } };
    }

    try {
      const result = await this.placeOrder.execute(req.body);
      return { status: 201, body: { data: result } };
    } catch (err) {
      if (err instanceof UseCaseValidationError || err instanceof DomainError) {
        return { status: 422, body: { error: err.message } };
      }
      return { status: 500, body: { error: 'Internal server error' } };
    }
  }
}
