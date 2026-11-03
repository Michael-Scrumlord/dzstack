import type { Clock, TimerHandle } from "../platform/clock.ts";
import type { IdGenerator } from "../platform/ids.ts";
import { NotFoundError, ReservationExpiredError } from "../platform/errors.ts";
import type { Store } from "../store/store.ts";
import type { EventBus } from "../bus/event-bus.ts";
import { EVENT, type ReservationExpiredPayload, type ReservationReleasedPayload } from "../bus/events.ts";
import type { Config } from "../config.ts";
import type { Ledger } from "./ledger.ts";
import type { WarehousePort } from "./warehouse.ts";
import type { ReleaseReason, Reservation, Sku } from "./types.ts";

export interface ReservationService {
  /** Holds qty units of sku for an order until it is confirmed, cancelled or the reservation expires. */
  reserve(input: { orderId: string; sku: Sku; qty: number }): Promise<Reservation>;
  /** The order was paid: the held units become sold. Confirming twice is fine. */
  commit(id: string): Promise<Reservation>;
  /** Gives the held units back. Returns true when this call released them, false when there was nothing to do. */
  release(id: string, reason: ReleaseReason): Promise<boolean>;
  get(id: string): Promise<Reservation | undefined>;
  list(filter?: (r: Reservation) => boolean): Promise<Reservation[]>;
  forOrder(orderId: string): Promise<Reservation[]>;
  /** Starts expiry timers for active reservations that have none (after a restart). Returns how many. */
  restoreTimers(): Promise<number>;
}

export interface ReservationDeps {
  store: Store;
  ledger: Ledger;
  bus: EventBus;
  warehouse: WarehousePort;
  clock: Clock;
  ids: IdGenerator;
  config: Config;
}

export function createReservationService(deps: ReservationDeps): ReservationService {
  const { store, ledger, bus, warehouse, clock, ids, config } = deps;
  const timers = new Map<string, TimerHandle>();

  function armTimer(r: Reservation): void {
    const delay = Math.max(0, r.expiresAt - clock.now());
    timers.set(
      r.id,
      clock.setTimeout(() => {
        timers.delete(r.id);
        bus.publish<ReservationExpiredPayload>(EVENT.reservationExpired, { reservationId: r.id, orderId: r.orderId });
      }, delay),
    );
  }

  function clearTimer(id: string): void {
    const timer = timers.get(id);
    if (timer === undefined) return;
    clock.clearTimeout(timer);
    timers.delete(id);
  }

  async function mustGet(id: string): Promise<Reservation> {
    const r = await store.reservations.get(id);
    if (!r) throw new NotFoundError("reservation", id);
    return r;
  }

  return {
    async reserve({ orderId, sku, qty }) {
      ledger.reserve(sku, qty);
      const now = clock.now();
      const r: Reservation = {
        id: ids.next("res"),
        orderId,
        sku,
        qty,
        status: "active",
        createdAt: now,
        expiresAt: now + config.reservationTtlMs,
      };
      await store.reservations.put(r);
      armTimer(r);
      return r;
    },

    async commit(id) {
      const r = await mustGet(id);
      if (r.status === "released") throw new ReservationExpiredError(id);
      if (r.status === "committed") return r;
      clearTimer(id);
      ledger.commit(r.sku, r.qty);
      const done: Reservation = { ...r, status: "committed", committedAt: clock.now() };
      await store.reservations.put(done);
      return done;
    },

    async release(id, reason) {
      const r = await mustGet(id);
      if (r.status !== "active") return false; // already released, or sold
      await warehouse.deallocate(r.id, r.sku, r.qty);
      ledger.release(r.sku, r.qty);
      clearTimer(id);
      await store.reservations.put({ ...r, status: "released", releasedAt: clock.now(), releaseReason: reason });
      bus.publish<ReservationReleasedPayload>(EVENT.reservationReleased, {
        reservationId: r.id,
        orderId: r.orderId,
        sku: r.sku,
        qty: r.qty,
        reason,
      });
      return true;
    },

    get(id) {
      return store.reservations.get(id);
    },

    list(filter) {
      return store.reservations.list(filter);
    },

    forOrder(orderId) {
      return store.reservations.list((r) => r.orderId === orderId);
    },

    async restoreTimers() {
      let restored = 0;
      for (const r of await store.reservations.list((x) => x.status === "active")) {
        if (timers.has(r.id)) continue;
        armTimer(r);
        restored++;
      }
      return restored;
    },
  };
}
