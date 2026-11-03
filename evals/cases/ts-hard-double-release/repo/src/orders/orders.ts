import type { Catalog } from "../catalog/catalog.ts";
import { defaultPricingRules, priceOrder } from "../catalog/pricing.ts";
import type { Clock } from "../platform/clock.ts";
import type { IdGenerator } from "../platform/ids.ts";
import { InvalidTransitionError, NotFoundError } from "../platform/errors.ts";
import type { EventBus } from "../bus/event-bus.ts";
import { EVENT, type OrderEventPayload } from "../bus/events.ts";
import type { Config } from "../config.ts";
import type { ReservationService } from "../inventory/reservations.ts";
import type { Store } from "../store/store.ts";
import type { Order, PlaceOrderInput } from "./types.ts";
import { validatePlaceOrder } from "./validation.ts";

export interface OrderService {
  /** Validates, holds stock for every line and records a pending order. All or nothing. */
  place(input: PlaceOrderInput): Promise<Order>;
  get(id: string): Promise<Order | undefined>;
  list(filter?: (order: Order) => boolean): Promise<Order[]>;
  /** Payment arrived: pending -> confirmed. Confirming a confirmed order returns it unchanged. */
  confirm(id: string): Promise<Order>;
  /** pending -> cancelled. Cancelling a cancelled order returns it unchanged; confirmed or expired orders cannot be cancelled. */
  cancel(id: string): Promise<Order>;
  /** Called when a reservation of the order ran out. pending -> expired; any other status is left alone. */
  expire(id: string): Promise<Order | undefined>;
}

export function createOrderService(deps: {
  store: Store;
  catalog: Catalog;
  reservations: ReservationService;
  bus: EventBus;
  clock: Clock;
  ids: IdGenerator;
  config: Config;
}): OrderService {
  const { store, catalog, reservations, bus, clock, ids, config } = deps;

  async function mustGet(id: string): Promise<Order> {
    const order = await store.orders.get(id);
    if (!order) throw new NotFoundError("order", id);
    return order;
  }

  return {
    async place(input) {
      const checked = validatePlaceOrder(input, catalog);
      const orderId = ids.next("ord");
      const held = [];
      try {
        for (const line of checked.lines) {
          held.push(await reservations.reserve({ orderId, sku: line.sku, qty: line.qty }));
        }
      } catch (error) {
        for (const r of held) await reservations.release(r.id, "order_cancelled");
        throw error;
      }

      const priced = priceOrder(
        checked.lines.map((line) => ({ item: catalog.get(line.sku), qty: line.qty })),
        defaultPricingRules(config.taxBasisPoints),
      );
      const now = clock.now();
      const order: Order = {
        id: orderId,
        customerId: checked.customerId,
        status: "pending",
        lines: priced.lines.map((line, i) => ({ ...line, reservationId: held[i].id })),
        totalCents: priced.totalCents,
        createdAt: now,
        updatedAt: now,
      };
      await store.orders.put(order);
      bus.publish<OrderEventPayload>(EVENT.orderPlaced, { orderId, customerId: order.customerId });
      return order;
    },

    get(id) {
      return store.orders.get(id);
    },

    list(filter) {
      return store.orders.list(filter);
    },

    async confirm(id) {
      const order = await mustGet(id);
      if (order.status === "confirmed") return order;
      if (order.status !== "pending") throw new InvalidTransitionError("order", order.status, "confirmed");
      for (const line of order.lines) await reservations.commit(line.reservationId);
      const done: Order = { ...order, status: "confirmed", updatedAt: clock.now() };
      await store.orders.put(done);
      bus.publish<OrderEventPayload>(EVENT.orderConfirmed, { orderId: id, customerId: order.customerId });
      return done;
    },

    async cancel(id) {
      const order = await mustGet(id);
      if (order.status === "cancelled") return order;
      if (order.status !== "pending") throw new InvalidTransitionError("order", order.status, "cancelled");
      const done: Order = { ...order, status: "cancelled", updatedAt: clock.now() };
      await store.orders.put(done);
      bus.publish<OrderEventPayload>(EVENT.orderCancelled, { orderId: id, customerId: order.customerId });
      return done;
    },

    async expire(id) {
      const order = await store.orders.get(id);
      if (!order || order.status !== "pending") return order;
      const done: Order = { ...order, status: "expired", updatedAt: clock.now() };
      await store.orders.put(done);
      bus.publish<OrderEventPayload>(EVENT.orderExpired, { orderId: id, customerId: order.customerId });
      return done;
    },
  };
}
