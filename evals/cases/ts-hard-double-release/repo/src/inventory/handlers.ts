import type { Clock } from "../platform/clock.ts";
import type { EventBus } from "../bus/event-bus.ts";
import { EVENT, type OrderEventPayload, type ReservationExpiredPayload } from "../bus/events.ts";
import { withRetry } from "../bus/retry.ts";
import type { Config } from "../config.ts";
import type { OrderService } from "../orders/orders.ts";
import type { ReservationService } from "./reservations.ts";

export const SUBSCRIBERS = {
  releaseOnCancel: "inventory.release-on-cancel",
  releaseOnExpiry: "inventory.release-on-expiry",
} as const;

/**
 * Stock goes back to the shelf for two reasons: the customer cancelled, or nobody paid in time.
 * Both handlers call the warehouse system, which is slow, so both are wrapped in the retry.
 */
export function registerInventoryHandlers(deps: {
  bus: EventBus;
  reservations: ReservationService;
  orders: OrderService;
  clock: Clock;
  config: Config;
}): void {
  const { bus, reservations, orders, clock, config } = deps;
  const retrying = <E>(handler: (event: E) => Promise<void>) => withRetry(handler, { ...config.retry, clock });

  bus.subscribe(
    EVENT.orderCancelled,
    SUBSCRIBERS.releaseOnCancel,
    retrying(async (event) => {
      const { orderId } = event.payload as OrderEventPayload;
      for (const r of await reservations.forOrder(orderId)) {
        await reservations.release(r.id, "order_cancelled");
      }
    }),
  );

  bus.subscribe(
    EVENT.reservationExpired,
    SUBSCRIBERS.releaseOnExpiry,
    retrying(async (event) => {
      const { reservationId, orderId } = event.payload as ReservationExpiredPayload;
      await reservations.release(reservationId, "expired");
      await orders.expire(orderId);
    }),
  );
}
