import type { CatalogItem, TaxClass } from "./catalog.ts";

export interface PricedLine {
  sku: string;
  qty: number;
  unitPriceCents: number;
  discountCents: number;
  taxCents: number;
  totalCents: number;
}

export interface PricingRules {
  taxBasisPoints: number;
  /** Quantity at or above which the bulk discount applies. */
  bulkThreshold: number;
  /** Bulk discount in basis points off the line subtotal. */
  bulkDiscountBasisPoints: number;
}

export const defaultPricingRules = (taxBasisPoints: number): PricingRules => ({
  taxBasisPoints,
  bulkThreshold: 10,
  bulkDiscountBasisPoints: 500,
});

function taxRateFor(taxClass: TaxClass, rules: PricingRules): number {
  switch (taxClass) {
    case "standard":
      return rules.taxBasisPoints;
    case "reduced":
      return Math.floor(rules.taxBasisPoints / 2);
    case "exempt":
      return 0;
  }
}

/** Rounds half up, in integer cents, so totals never drift by a fraction. */
function basisPoints(amountCents: number, bp: number): number {
  return Math.floor((amountCents * bp + 5000) / 10000);
}

export function priceLine(item: CatalogItem, qty: number, rules: PricingRules): PricedLine {
  const subtotal = item.priceCents * qty;
  const discountCents = qty >= rules.bulkThreshold ? basisPoints(subtotal, rules.bulkDiscountBasisPoints) : 0;
  const taxable = subtotal - discountCents;
  const taxCents = basisPoints(taxable, taxRateFor(item.taxClass, rules));
  return {
    sku: item.sku,
    qty,
    unitPriceCents: item.priceCents,
    discountCents,
    taxCents,
    totalCents: taxable + taxCents,
  };
}

export function priceOrder(
  lines: Array<{ item: CatalogItem; qty: number }>,
  rules: PricingRules,
): { lines: PricedLine[]; totalCents: number } {
  const priced = lines.map(({ item, qty }) => priceLine(item, qty, rules));
  return { lines: priced, totalCents: priced.reduce((sum, line) => sum + line.totalCents, 0) };
}

export function formatMoney(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}
