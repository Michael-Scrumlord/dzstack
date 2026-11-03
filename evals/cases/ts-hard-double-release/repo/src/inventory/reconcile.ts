import type { Clock } from "../platform/clock.ts";
import type { Logger } from "../platform/logger.ts";
import type { OrderService } from "../orders/orders.ts";
import type { Ledger } from "./ledger.ts";
import type { ReservationService } from "./reservations.ts";
import type { Sku } from "./types.ts";

export interface Drift {
  sku: Sku;
  expected: { reserved: number; sold: number };
  actual: { reserved: number; sold: number; available: number; onHand: number };
}

export interface ReconcileReport {
  ranAt: number;
  /** Active reservations past their expiry that nothing had released (a lost timer). */
  expiredReleased: number;
  /** Active reservations whose order is cancelled, expired or gone. */
  orphansReleased: number;
  /** SKUs whose counters did not match the reservation table; they were corrected. */
  drift: Drift[];
}

export interface Reconciler {
  run(): Promise<ReconcileReport>;
}

const sum = (rows: Array<{ qty: number }>): number => rows.reduce((total, row) => total + row.qty, 0);

/**
 * The nightly safety net (see docs/operations.md). It releases reservations that slipped through, then
 * compares the ledger with the reservation table and corrects any SKU whose counters disagree with it.
 */
export function createReconciler(deps: {
  reservations: ReservationService;
  orders: OrderService;
  ledger: Ledger;
  clock: Clock;
  logger: Logger;
}): Reconciler {
  const { reservations, orders, ledger, clock, logger } = deps;

  return {
    async run() {
      const report: ReconcileReport = { ranAt: clock.now(), expiredReleased: 0, orphansReleased: 0, drift: [] };

      for (const r of await reservations.list((x) => x.status === "active")) {
        if (r.expiresAt <= clock.now()) {
          if (await reservations.release(r.id, "reconcile")) report.expiredReleased++;
          continue;
        }
        const order = await orders.get(r.orderId);
        if (!order || order.status === "cancelled" || order.status === "expired") {
          if (await reservations.release(r.id, "reconcile")) report.orphansReleased++;
        }
      }

      for (const sku of ledger.skus()) {
        const rows = await reservations.list((x) => x.sku === sku);
        const expected = {
          reserved: sum(rows.filter((x) => x.status === "active")),
          sold: sum(rows.filter((x) => x.status === "committed")),
        };
        const c = ledger.snapshot(sku);
        if (c.reserved !== expected.reserved || c.sold !== expected.sold) {
          report.drift.push({ sku, expected, actual: { reserved: c.reserved, sold: c.sold, available: c.available, onHand: c.onHand } });
          ledger.repair(sku, expected);
        }
      }

      if (report.drift.length) logger.warn("reconcile corrected stock counters", { skus: report.drift.map((d) => d.sku) });
      return report;
    },
  };
}
