import { test } from "node:test";
import assert from "node:assert/strict";
import { paginate } from "../src/paginate.ts";
import { listOrders } from "../src/orders.ts";

const range = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

test("the last partial page is reachable", () => {
  const p = paginate(range(45), 3, 20);
  assert.deepEqual(p.items, [41, 42, 43, 44, 45]);
  assert.equal(p.totalPages, 3);
  assert.equal(p.hasNext, false);
});

test("hasNext is true before the partial page", () => {
  const p = paginate(range(45), 2, 20);
  assert.equal(p.hasNext, true);
  assert.equal(p.items.length, 20);
});

test("fewer items than one page make one page", () => {
  const p = paginate(range(3), 1, 20);
  assert.deepEqual(p.items, [1, 2, 3]);
  assert.equal(p.totalPages, 1);
  assert.equal(p.hasNext, false);
});

test("no items means no pages", () => {
  const p = paginate([], 1, 20);
  assert.deepEqual(p.items, []);
  assert.equal(p.totalPages, 0);
  assert.equal(p.hasNext, false);
});

test("a page past the end is empty", () => {
  const p = paginate(range(45), 4, 20);
  assert.deepEqual(p.items, []);
  assert.equal(p.hasNext, false);
});

test("exact multiples are unchanged", () => {
  assert.equal(paginate(range(40), 2, 20).totalPages, 2);
  assert.equal(paginate(range(40), 2, 20).hasNext, false);
});

test("the orders endpoint reaches order 45", () => {
  const orders = range(45).map((id) => ({ id, customer: "c", totalCents: id }));
  assert.deepEqual(listOrders(orders, { page: "3" }).items.map((o) => o.id), [41, 42, 43, 44, 45]);
});
