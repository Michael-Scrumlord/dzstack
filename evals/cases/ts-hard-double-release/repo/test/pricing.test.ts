import { test } from "node:test";
import assert from "node:assert/strict";
import { defaultPricingRules, formatMoney, priceLine, priceOrder } from "../src/catalog/pricing.ts";

const rules = defaultPricingRules(2000);
const widget = { sku: "WID-1", name: "Widget", priceCents: 1000, taxClass: "standard" as const };
const gadget = { sku: "GAD-2", name: "Gadget", priceCents: 2550, taxClass: "reduced" as const };
const book = { sku: "BOK-3", name: "Book", priceCents: 1299, taxClass: "exempt" as const };

test("a standard line carries the full tax", () => {
  assert.deepEqual(priceLine(widget, 2, rules), {
    sku: "WID-1", qty: 2, unitPriceCents: 1000, discountCents: 0, taxCents: 400, totalCents: 2400,
  });
});

test("reduced tax is half, exempt is none", () => {
  assert.equal(priceLine(gadget, 1, rules).taxCents, 255);
  assert.equal(priceLine(book, 1, rules).taxCents, 0);
});

test("bulk orders get a discount before tax", () => {
  const line = priceLine(widget, 10, rules);
  assert.equal(line.discountCents, 500);
  assert.equal(line.taxCents, 1900);
  assert.equal(line.totalCents, 9500 + 1900);
});

test("order totals add up the lines", () => {
  const priced = priceOrder([{ item: widget, qty: 1 }, { item: book, qty: 2 }], rules);
  assert.equal(priced.totalCents, 1200 + 2598);
});

test("money formats as decimals", () => {
  assert.equal(formatMoney(5), "0.05");
  assert.equal(formatMoney(123456), "1234.56");
  assert.equal(formatMoney(-250), "-2.50");
});
