import { test } from "node:test";
import assert from "node:assert/strict";
import { makeApp, settle } from "./helpers.ts";

const widgets = (qty: number) => ({ customerId: "ann", lines: [{ sku: "WID-1", qty }] });

test("placing an order holds stock for every line and prices the order", async () => {
  const app = makeApp();
  const order = await app.orders.place({ customerId: "ann", lines: [{ sku: "WID-1", qty: 2 }, { sku: "BOK-3", qty: 1 }] });
  assert.equal(order.status, "pending");
  assert.equal(order.totalCents, 2400 + 1299);
  assert.equal(app.ledger.snapshot("WID-1").available, 18);
  assert.equal(app.ledger.snapshot("BOK-3").available, 2);
  const held = await app.reservations.forOrder(order.id);
  assert.deepEqual(order.lines.map((l) => l.reservationId), held.map((r) => r.id));
});

test("repeated SKUs are merged into one line", async () => {
  const app = makeApp();
  const order = await app.orders.place({ customerId: "ann", lines: [{ sku: "WID-1", qty: 2 }, { sku: "WID-1", qty: 3 }] });
  assert.equal(order.lines.length, 1);
  assert.equal(order.lines[0].qty, 5);
});

test("an order that cannot be fully reserved holds nothing", async () => {
  const app = makeApp();
  await assert.rejects(app.orders.place({ customerId: "ann", lines: [{ sku: "WID-1", qty: 2 }, { sku: "BOK-3", qty: 9 }] }), {
    code: "insufficient_stock",
  });
  assert.equal(app.ledger.snapshot("WID-1").available, 20);
  assert.equal(app.ledger.snapshot("BOK-3").available, 3);
  assert.deepEqual(await app.orders.list(), []);
});

test("invalid input is rejected before anything is held", async () => {
  const app = makeApp();
  await assert.rejects(app.orders.place({ customerId: " ", lines: [{ sku: "WID-1", qty: 1 }] }), { code: "validation" });
  await assert.rejects(app.orders.place({ customerId: "ann", lines: [] }), { code: "validation" });
  await assert.rejects(app.orders.place({ customerId: "ann", lines: [{ sku: "NOP-1", qty: 1 }] }), { code: "validation" });
  await assert.rejects(app.orders.place({ customerId: "ann", lines: [{ sku: "WID-1", qty: 0 }] }), { code: "validation" });
  assert.equal(app.ledger.snapshot("WID-1").available, 20);
});

test("confirming sells the units", async () => {
  const app = makeApp();
  const order = await app.orders.place(widgets(4));
  const done = await app.orders.confirm(order.id);
  assert.equal(done.status, "confirmed");
  assert.deepEqual(app.ledger.snapshot("WID-1"), { sku: "WID-1", onHand: 20, available: 16, reserved: 0, sold: 4 });
  assert.equal((await app.orders.confirm(order.id)).status, "confirmed");
});

test("cancelling frees the stock once the event has been handled", async () => {
  const app = makeApp();
  const order = await app.orders.place(widgets(4));
  const done = await app.orders.cancel(order.id);
  assert.equal(done.status, "cancelled");
  await settle();
  assert.deepEqual(app.ledger.snapshot("WID-1"), { sku: "WID-1", onHand: 20, available: 20, reserved: 0, sold: 0 });
  assert.equal((await app.reservations.forOrder(order.id))[0].releaseReason, "order_cancelled");
});

test("cancelling twice is a no-op, cancelling a confirmed order is refused", async () => {
  const app = makeApp();
  const a = await app.orders.place(widgets(1));
  await app.orders.cancel(a.id);
  await settle();
  assert.equal((await app.orders.cancel(a.id)).status, "cancelled");
  await settle();
  assert.equal(app.ledger.snapshot("WID-1").available, 20);
  const b = await app.orders.place(widgets(1));
  await app.orders.confirm(b.id);
  await assert.rejects(app.orders.cancel(b.id), { code: "invalid_transition" });
});

test("a cancelled order can no longer be confirmed", async () => {
  const app = makeApp();
  const order = await app.orders.place(widgets(1));
  await app.orders.cancel(order.id);
  await assert.rejects(app.orders.confirm(order.id), { code: "invalid_transition" });
});

test("unknown orders are not found", async () => {
  const app = makeApp();
  await assert.rejects(app.orders.cancel("ord_404"), { code: "not_found" });
  assert.equal(await app.orders.get("ord_404"), undefined);
});
