import { InsufficientStockError, NotFoundError, ValidationError } from "../platform/errors.ts";
import type { Sku, StockCounts } from "./types.ts";

export interface Ledger {
  /** New units arrive: onHand and available both grow. */
  receive(sku: Sku, qty: number): void;
  /** Units found damaged or missing in a count: onHand and available both shrink. */
  writeOff(sku: Sku, qty: number): void;
  /** Moves qty from available to reserved. Throws InsufficientStockError when there is not enough. */
  reserve(sku: Sku, qty: number): void;
  /** Gives reserved units back to available. */
  release(sku: Sku, qty: number): void;
  /** Turns reserved units into sold units. */
  commit(sku: Sku, qty: number): void;
  /** Overwrites reserved and sold, then recomputes available. Used by reconcile when it finds drift. */
  repair(sku: Sku, fixed: { reserved: number; sold: number }): void;
  snapshot(sku: Sku): StockCounts;
  skus(): Sku[];
  all(): StockCounts[];
}

function positive(qty: number): void {
  if (!Number.isInteger(qty) || qty <= 0) throw new ValidationError(`quantity must be a positive whole number, got ${qty}`);
}

/** A counter never goes below zero. */
const minus = (value: number, qty: number): number => Math.max(0, value - qty);

export function createLedger(): Ledger {
  const counts = new Map<Sku, StockCounts>();

  function must(sku: Sku): StockCounts {
    const c = counts.get(sku);
    if (!c) throw new NotFoundError("stock for", sku);
    return c;
  }

  return {
    receive(sku, qty) {
      positive(qty);
      const c = counts.get(sku) ?? { sku, onHand: 0, available: 0, reserved: 0, sold: 0 };
      c.onHand += qty;
      c.available += qty;
      counts.set(sku, c);
    },
    writeOff(sku, qty) {
      positive(qty);
      const c = must(sku);
      if (qty > c.available) throw new InsufficientStockError(sku, qty, c.available);
      c.onHand -= qty;
      c.available -= qty;
    },
    reserve(sku, qty) {
      positive(qty);
      const c = must(sku);
      if (qty > c.available) throw new InsufficientStockError(sku, qty, c.available);
      c.available -= qty;
      c.reserved += qty;
    },
    release(sku, qty) {
      positive(qty);
      const c = must(sku);
      c.reserved = minus(c.reserved, qty);
      c.available += qty;
    },
    commit(sku, qty) {
      positive(qty);
      const c = must(sku);
      c.reserved = minus(c.reserved, qty);
      c.sold += qty;
    },
    repair(sku, fixed) {
      const c = must(sku);
      c.reserved = fixed.reserved;
      c.sold = fixed.sold;
      c.available = c.onHand - c.reserved - c.sold;
    },
    snapshot(sku) {
      return { ...must(sku) };
    },
    skus() {
      return [...counts.keys()].sort();
    },
    all() {
      return this.skus().map((sku) => ({ ...must(sku) }));
    },
  };
}
