// Docs: inventory-model.md (cancelling gives the stock back straight away) and operations.md (the nightly reconcile is the
// safety net for releases the handlers did not finish).
import { test } from "node:test";
import assert from "node:assert/strict";
import { counts, drain, flush, releaseJobs, RETRY, tableInvariant, world, TTL } from "./support.ts";

test("cancelling gives the stock back at once, without waiting for the reservation to expire", async () => {
  const w = world();
  const a = await w.app.orders.place({ customerId: "ann", lines: [{ sku: "WID-1", qty: 4 }, { sku: "GAD-2", qty: 2 }] });
  await flush();
  await w.app.orders.cancel(a.id);
  await drain(w);
  assert.deepEqual(counts(w.app, "WID-1"), { onHand: 10, available: 10, reserved: 0, sold: 0 });
  assert.deepEqual(counts(w.app, "GAD-2"), { onHand: 6, available: 6, reserved: 0, sold: 0 });
  await tableInvariant(w.app, "settled");
});

test("a reservation that nobody pays for expires and its stock goes back", async () => {
  const w = world();
  const a = await w.app.orders.place({ customerId: "ann", lines: [{ sku: "WID-1", qty: 4 }] });
  await flush();
  w.clock.advance(TTL - 1);
  await drain(w);
  assert.equal(counts(w.app).available, 6);
  w.clock.advance(1);
  await drain(w);
  assert.deepEqual(counts(w.app), { onHand: 10, available: 10, reserved: 0, sold: 0 });
  assert.equal((await w.app.orders.get(a.id))?.status, "expired");
  await tableInvariant(w.app, "settled");
});

test("a cancellation that every retry fails on is picked up by reconcile once the warehouse is back", async () => {
  let down = true;
  const w = world({ decide: () => (down ? "fail" : "ok") });
  const a = await w.app.orders.place({ customerId: "ann", lines: [{ sku: "WID-1", qty: 4 }] });
  await flush();
  await w.app.orders.cancel(a.id);
  await flush();
  const [job] = releaseJobs(w, "order.cancelled");
  const finished = w.transport.start(job);
  for (let i = 0; i < RETRY.attempts; i++) {
    await flush();
    w.clock.advance(RETRY.backoffMs * (i + 1));
  }
  await finished;
  await flush();
  assert.ok(w.app.bus.deadLetters.length >= 1, "the failure is dead-lettered");
  assert.deepEqual(counts(w.app), { onHand: 10, available: 6, reserved: 4, sold: 0 }, "nothing was released, and nothing is claimed as released");
  down = false;
  const report = await w.app.reconciler.run();
  assert.equal(report.orphansReleased, 1);
  await flush();
  assert.deepEqual(counts(w.app), { onHand: 10, available: 10, reserved: 0, sold: 0 });
  await drain(w);
  await tableInvariant(w.app, "settled");
  assert.deepEqual(counts(w.app), { onHand: 10, available: 10, reserved: 0, sold: 0 });
});

test("reservations whose timers were lost are released by reconcile, and the stock comes back once, even when reconcile runs twice at the same time", async () => {
  const w = world({ hops: 2 });
  await w.app.orders.place({ customerId: "ann", lines: [{ sku: "WID-1", qty: 4 }] });
  await w.app.orders.place({ customerId: "bob", lines: [{ sku: "GAD-2", qty: 5 }] });
  await flush();
  w.clock.jump(TTL + 1);
  const [one, two] = await Promise.all([w.app.reconciler.run(), w.app.reconciler.run()]);
  await flush();
  assert.ok(one.expiredReleased + two.expiredReleased >= 2, "both reservations were found and released");
  await tableInvariant(w.app, "settled");
  assert.deepEqual(counts(w.app, "WID-1"), { onHand: 10, available: 10, reserved: 0, sold: 0 });
  assert.deepEqual(counts(w.app, "GAD-2"), { onHand: 6, available: 6, reserved: 0, sold: 0 });
});

test("reconcile does not undo a release that is half way through", async () => {
  const w = world({ decide: (c) => (c.n === 1 ? "hang" : "ok") });
  const a = await w.app.orders.place({ customerId: "ann", lines: [{ sku: "WID-1", qty: 4 }] });
  await flush();
  await w.app.orders.cancel(a.id);
  await flush();
  const [job] = releaseJobs(w, "order.cancelled");
  void w.transport.start(job); // waiting on the warehouse
  await flush();
  await w.app.reconciler.run(); // releases the orphan itself (the warehouse answers this call)
  await flush();
  assert.deepEqual(counts(w.app), { onHand: 10, available: 10, reserved: 0, sold: 0 });
  w.warehouse.openAll();
  await flush();
  await drain(w);
  await tableInvariant(w.app, "settled");
  assert.deepEqual(counts(w.app), { onHand: 10, available: 10, reserved: 0, sold: 0 });
});

test("reconcile leaves live and sold reservations alone", async () => {
  const w = world();
  const live = await w.app.orders.place({ customerId: "ann", lines: [{ sku: "WID-1", qty: 4 }] });
  const sold = await w.app.orders.place({ customerId: "bob", lines: [{ sku: "WID-1", qty: 3 }] });
  await w.app.orders.confirm(sold.id);
  await flush();
  const report = await w.app.reconciler.run();
  assert.deepEqual([report.expiredReleased, report.orphansReleased, report.drift.length], [0, 0, 0]);
  assert.deepEqual(counts(w.app), { onHand: 10, available: 3, reserved: 4, sold: 3 });
  assert.equal((await w.app.reservations.forOrder(live.id))[0].status, "active");
  await drain(w);
  await tableInvariant(w.app, "settled");
});
