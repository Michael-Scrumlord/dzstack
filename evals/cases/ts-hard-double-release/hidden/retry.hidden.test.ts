// Docs: events.md (a timed-out attempt is not cancelled and can finish later; a hung attempt must never stop a later one
// from finishing the job; delivery is at least once) and inventory-model.md (the warehouse call is safe to repeat).
import { test } from "node:test";
import assert from "node:assert/strict";
import { counts, drain, flush, releaseJobs, RETRY, tableInvariant, weakInvariant, world, TTL } from "./support.ts";

async function placeAndCancel(w: ReturnType<typeof world>, lines = [{ sku: "WID-1", qty: 4 }]) {
  const a = await w.app.orders.place({ customerId: "ann", lines });
  await w.app.orders.cancel(a.id);
  await flush();
  return a;
}

/** Starts the cancel handler, lets its first attempt time out and its second attempt begin. */
async function startRetry(w: ReturnType<typeof world>) {
  const [job] = releaseJobs(w, "order.cancelled");
  assert.ok(job, "a release subscriber must be listening to order.cancelled");
  const finished = w.transport.start(job);
  await flush();
  w.clock.advance(RETRY.timeoutMs); // attempt 1 times out
  await flush();
  w.clock.advance(RETRY.backoffMs); // backoff, then attempt 2
  await flush();
  return { finished };
}

test("an attempt that never answers does not stop the retry from releasing, and it does not release again when it wakes up", async () => {
  const w = world({ decide: (c) => (c.n === 1 ? "hang" : "ok") });
  const a = await placeAndCancel(w);
  assert.deepEqual(counts(w.app), { onHand: 10, available: 6, reserved: 4, sold: 0 });
  await startRetry(w);
  assert.deepEqual(counts(w.app), { onHand: 10, available: 10, reserved: 0, sold: 0 }, "attempt 2 should have released the stock");
  assert.equal(w.warehouse.hanging(), 1);
  w.warehouse.openAll(); // the warehouse finally answers attempt 1
  await flush();
  await drain(w);
  weakInvariant(w.app, "after the late answer");
  await tableInvariant(w.app, "settled");
  assert.deepEqual(counts(w.app), { onHand: 10, available: 10, reserved: 0, sold: 0 });
  assert.equal((await w.app.reservations.forOrder(a.id))[0].status, "released");
});

test("two attempts that are both waiting on the warehouse and answer in the same moment release once", async () => {
  for (const hops of [0, 1, 3]) {
    const w = world({ hops, decide: (c) => (c.n <= 2 ? "hang" : "ok") });
    const other = await w.app.orders.place({ customerId: "bob", lines: [{ sku: "WID-1", qty: 3 }] });
    await placeAndCancel(w);
    await startRetry(w);
    assert.equal(w.warehouse.hanging(), 2, "both attempts are stuck on the warehouse");
    assert.deepEqual(counts(w.app), { onHand: 10, available: 3, reserved: 7, sold: 0 });
    w.warehouse.openAll();
    await flush();
    await drain(w);
    await tableInvariant(w.app, `hops ${hops}`);
    assert.deepEqual(counts(w.app), { onHand: 10, available: 7, reserved: 3, sold: 0 }, `hops ${hops}: B's units must stay reserved`);
    assert.equal((await w.app.reservations.forOrder(other.id))[0].status, "active");
  }
});

test("an expiry handler that hangs and a cancellation that completes in the meantime release once", async () => {
  const w = world({ decide: (c) => (c.n === 1 ? "hang" : "ok") });
  const a = await w.app.orders.place({ customerId: "ann", lines: [{ sku: "WID-1", qty: 4 }] });
  await flush();
  w.clock.advance(TTL); // the expiry event is queued
  await flush();
  const [expiry] = releaseJobs(w, "reservation.expired");
  void w.transport.start(expiry); // its warehouse call hangs
  await flush();
  await w.app.orders.cancel(a.id);
  await flush();
  const [cancel] = releaseJobs(w, "order.cancelled");
  await w.transport.start(cancel);
  await flush();
  assert.deepEqual(counts(w.app), { onHand: 10, available: 10, reserved: 0, sold: 0 });
  w.warehouse.openAll();
  await flush();
  await drain(w);
  await tableInvariant(w.app, "settled");
  assert.deepEqual(counts(w.app), { onHand: 10, available: 10, reserved: 0, sold: 0 });
});

test("a cancellation that hangs, an expiry that completes meanwhile, and the cancellation waking up late release once", async () => {
  const w = world({ decide: (c) => (c.n === 1 ? "hang" : "ok") });
  const a = await w.app.orders.place({ customerId: "ann", lines: [{ sku: "WID-1", qty: 4 }] });
  const other = await w.app.orders.place({ customerId: "bob", lines: [{ sku: "WID-1", qty: 3 }] });
  await flush();
  await w.app.orders.cancel(a.id);
  await flush();
  const [cancel] = releaseJobs(w, "order.cancelled");
  void w.transport.start(cancel); // its warehouse call hangs
  await flush();
  w.clock.advance(TTL); // both reservations expire
  await flush();
  for (const job of releaseJobs(w, "reservation.expired")) void w.transport.start(job);
  await flush();
  assert.deepEqual(counts(w.app), { onHand: 10, available: 10, reserved: 0, sold: 0 }, "the expiries released both reservations");
  w.warehouse.openAll(); // the cancellation's attempt wakes up
  await flush();
  await drain(w);
  await tableInvariant(w.app, "settled");
  assert.deepEqual(counts(w.app), { onHand: 10, available: 10, reserved: 0, sold: 0 });
  assert.equal((await w.app.reservations.forOrder(other.id))[0].status, "released");
});

test("a failing warehouse call is retried and the stock is released once, not zero times and not twice", async () => {
  const w = world({ decide: (c) => (c.nth === 1 ? "fail" : "ok") });
  const a = await placeAndCancel(w);
  const [job] = releaseJobs(w, "order.cancelled");
  const finished = w.transport.start(job);
  await flush();
  assert.deepEqual(counts(w.app), { onHand: 10, available: 6, reserved: 4, sold: 0 }, "nothing is released while the warehouse refuses");
  w.clock.advance(RETRY.backoffMs);
  await finished;
  await flush();
  await drain(w);
  await tableInvariant(w.app, "settled");
  assert.deepEqual(counts(w.app), { onHand: 10, available: 10, reserved: 0, sold: 0 });
  const reservation = (await w.app.reservations.forOrder(a.id))[0];
  assert.equal(reservation.status, "released");
  assert.ok((w.warehouse.succeeded.get(reservation.id) ?? 0) >= 1, "the warehouse must have been told once the stock went back");
});

test("an order with two lines where one release fails first: the retry finishes the other line and does not repeat the first", async () => {
  let failed = false;
  const w = world({
    decide: (c) => {
      if (c.sku === "GAD-2" && !failed) {
        failed = true;
        return "fail";
      }
      return "ok";
    },
  });
  const a = await placeAndCancel(w, [{ sku: "WID-1", qty: 4 }, { sku: "GAD-2", qty: 5 }]);
  const [job] = releaseJobs(w, "order.cancelled");
  const finished = w.transport.start(job);
  await flush();
  weakInvariant(w.app, "after the first attempt");
  w.clock.advance(RETRY.backoffMs);
  await finished;
  await flush();
  await drain(w);
  await tableInvariant(w.app, "settled");
  assert.deepEqual(counts(w.app, "WID-1"), { onHand: 10, available: 10, reserved: 0, sold: 0 });
  assert.deepEqual(counts(w.app, "GAD-2"), { onHand: 6, available: 6, reserved: 0, sold: 0 });
  for (const r of await w.app.reservations.forOrder(a.id)) assert.equal(r.status, "released");
});
