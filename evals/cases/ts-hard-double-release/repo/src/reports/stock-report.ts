import type { Catalog } from "../catalog/catalog.ts";
import type { StockCounts } from "../inventory/types.ts";
import { table } from "./format.ts";

export type Flag = "LOW" | "OVERSTATED" | "MISMATCH";

export interface StockRow extends StockCounts {
  name: string;
  flags: Flag[];
}

/**
 * LOW: fewer than `lowStockThreshold` units available.
 * OVERSTATED: the shop would sell more than the warehouse holds (available above onHand).
 * MISMATCH: the counters do not add up (available + reserved + sold is not onHand).
 */
export function buildStockReport(counts: StockCounts[], catalog: Catalog, lowStockThreshold: number): StockRow[] {
  return counts.map((c) => {
    const flags: Flag[] = [];
    if (c.available < lowStockThreshold) flags.push("LOW");
    if (c.available > c.onHand) flags.push("OVERSTATED");
    if (c.available + c.reserved + c.sold !== c.onHand) flags.push("MISMATCH");
    return { ...c, name: catalog.has(c.sku) ? catalog.get(c.sku).name : "(not in catalog)", flags };
  });
}

export function renderStockReport(rows: StockRow[]): string {
  return table(
    ["SKU", "NAME", "ON HAND", "AVAILABLE", "RESERVED", "SOLD", "FLAGS"],
    rows.map((r) => [r.sku, r.name, String(r.onHand), String(r.available), String(r.reserved), String(r.sold), r.flags.join(",")]),
  );
}

export function problems(rows: StockRow[]): StockRow[] {
  return rows.filter((r) => r.flags.includes("OVERSTATED") || r.flags.includes("MISMATCH"));
}
