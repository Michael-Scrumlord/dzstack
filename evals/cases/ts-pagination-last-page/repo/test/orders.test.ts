import { test } from "node:test";
import assert from "node:assert/strict";
import { listOrders } from "../src/orders.ts";

const orders = Array.from({ length: 60 }, (_, i) => ({ id: i + 1, customer: `c${i % 7}`, totalCents: 100 * (i + 1) }));

test("defaults to page 1 of 20", () => {
  const p = listOrders(orders, {});
  assert.equal(p.items.length, 20);
  assert.equal(p.items[0].id, 1);
});

test("caps perPage at 100", () => {
  assert.equal(listOrders(orders, { perPage: "500" }).perPage, 100);
});
