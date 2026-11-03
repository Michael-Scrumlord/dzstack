import { test } from "node:test";
import assert from "node:assert/strict";
import { createManualClock, createManualTransport, createRecordingWarehouse, makeApp, settle } from "./helpers.ts";

const TTL = 15 * 60 * 1000;

test("reserving holds stock and records an active reservation", async () => {
  const app = makeApp();
  const r = await app.reservations.reserve({ orderId: "ord_x", sku: "WID-1", qty: 5 });
  assert.equal(r.status, "active");
  assert.deepEqual(app.ledger.snapshot("WID-1"), { sku: "WID-1", onHand: 20, available: 15, reserved: 5, sold: 0 });
  assert.deepEqual(await app.reservations.get(r.id), r);
});

test("reserving more than is available fails and holds nothing", async () => {
  const app = makeApp();
  await assert.rejects(app.reservations.reserve({ orderId: "ord_x", sku: "BOK-3", qty: 4 }), { code: "insufficient_stock" });
  assert.equal(app.ledger.snapshot("BOK-3").available, 3);
  assert.deepEqual(await app.reservations.list(), []);
});

test("releasing returns the stock and tells the warehouse", async () => {
  const warehouse = createRecordingWarehouse();
  const app = makeApp({ warehouse });
  const r = await app.reservations.reserve({ orderId: "ord_x", sku: "WID-1", qty: 5 });
  assert.equal(await app.reservations.release(r.id, "order_cancelled"), true);
  assert.deepEqual(app.ledger.snapshot("WID-1"), { sku: "WID-1", onHand: 20, available: 20, reserved: 0, sold: 0 });
  assert.deepEqual(warehouse.calls, [{ reservationId: r.id, sku: "WID-1", qty: 5 }]);
  const stored = await app.reservations.get(r.id);
  assert.equal(stored?.status, "released");
  assert.equal(stored?.releaseReason, "order_cancelled");
});

test("releasing a released reservation again changes nothing", async () => {
  const app = makeApp();
  const r = await app.reservations.reserve({ orderId: "ord_x", sku: "WID-1", qty: 5 });
  await app.reservations.release(r.id, "order_cancelled");
  assert.equal(await app.reservations.release(r.id, "expired"), false);
  assert.equal(app.ledger.snapshot("WID-1").available, 20);
});

test("committing makes the units sold, and committing twice is fine", async () => {
  const app = makeApp();
  const r = await app.reservations.reserve({ orderId: "ord_x", sku: "WID-1", qty: 5 });
  await app.reservations.commit(r.id);
  await app.reservations.commit(r.id);
  assert.deepEqual(app.ledger.snapshot("WID-1"), { sku: "WID-1", onHand: 20, available: 15, reserved: 0, sold: 5 });
});

test("a committed reservation cannot be released, a released one cannot be committed", async () => {
  const app = makeApp();
  const a = await app.reservations.reserve({ orderId: "ord_a", sku: "WID-1", qty: 2 });
  const b = await app.reservations.reserve({ orderId: "ord_b", sku: "WID-1", qty: 3 });
  await app.reservations.commit(a.id);
  assert.equal(await app.reservations.release(a.id, "expired"), false);
  await app.reservations.release(b.id, "expired");
  await assert.rejects(app.reservations.commit(b.id), { code: "reservation_expired" });
  assert.deepEqual(app.ledger.snapshot("WID-1"), { sku: "WID-1", onHand: 20, available: 18, reserved: 0, sold: 2 });
});

test("unknown reservations are not found", async () => {
  const app = makeApp();
  await assert.rejects(app.reservations.release("res_404", "expired"), { code: "not_found" });
  await assert.rejects(app.reservations.commit("res_404"), { code: "not_found" });
});

test("an unpaid reservation expires after the TTL and its stock goes back", async () => {
  const clock = createManualClock();
  const app = makeApp({ clock });
  const order = await app.orders.place({ customerId: "ann", lines: [{ sku: "WID-1", qty: 5 }] });
  clock.advance(TTL - 1);
  await settle();
  assert.equal(app.ledger.snapshot("WID-1").available, 15);
  clock.advance(1);
  await settle();
  assert.equal(app.ledger.snapshot("WID-1").available, 20);
  assert.equal((await app.orders.get(order.id))?.status, "expired");
  assert.equal((await app.reservations.forOrder(order.id))[0].releaseReason, "expired");
});

test("confirming stops the expiry timer", async () => {
  const clock = createManualClock();
  const app = makeApp({ clock });
  const order = await app.orders.place({ customerId: "ann", lines: [{ sku: "WID-1", qty: 5 }] });
  assert.equal(clock.pending(), 1);
  await app.orders.confirm(order.id);
  assert.equal(clock.pending(), 0);
  clock.advance(TTL * 2);
  await settle();
  assert.deepEqual(app.ledger.snapshot("WID-1"), { sku: "WID-1", onHand: 20, available: 15, reserved: 0, sold: 5 });
});

test("restoreTimers re-arms active reservations that have no timer", async () => {
  const clock = createManualClock();
  const transport = createManualTransport();
  const app = makeApp({ clock, transport });
  await app.reservations.reserve({ orderId: "ord_x", sku: "WID-1", qty: 1 });
  assert.equal(await app.reservations.restoreTimers(), 0, "the timer is still there");
  clock.advance(TTL); // the timer fires; its event is queued but nobody handles it
  assert.equal(await app.reservations.restoreTimers(), 1, "still active, no timer: armed again");
  assert.equal(clock.pending(), 1);
});
