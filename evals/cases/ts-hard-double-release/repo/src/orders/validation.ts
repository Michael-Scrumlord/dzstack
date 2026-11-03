import type { Catalog } from "../catalog/catalog.ts";
import { ValidationError } from "../platform/errors.ts";
import type { PlaceOrderInput } from "./types.ts";

export const MAX_LINES = 50;
export const MAX_QTY_PER_LINE = 500;

/** Checks the input and merges repeated SKUs into one line, keeping the order of first appearance. */
export function validatePlaceOrder(input: PlaceOrderInput, catalog: Catalog): PlaceOrderInput {
  const customerId = input.customerId?.trim();
  if (!customerId) throw new ValidationError("customerId is required");
  if (!Array.isArray(input.lines) || input.lines.length === 0) throw new ValidationError("an order needs at least one line");
  if (input.lines.length > MAX_LINES) throw new ValidationError(`an order can have at most ${MAX_LINES} lines`);

  const merged = new Map<string, number>();
  for (const line of input.lines) {
    if (!catalog.has(line.sku)) throw new ValidationError(`unknown SKU ${line.sku}`);
    if (!Number.isInteger(line.qty) || line.qty <= 0) throw new ValidationError(`${line.sku}: quantity must be a positive whole number`);
    const total = (merged.get(line.sku) ?? 0) + line.qty;
    if (total > MAX_QTY_PER_LINE) throw new ValidationError(`${line.sku}: at most ${MAX_QTY_PER_LINE} units per order`);
    merged.set(line.sku, total);
  }
  return { customerId, lines: [...merged].map(([sku, qty]) => ({ sku, qty })) };
}
