import { test } from "node:test";
import assert from "node:assert/strict";
import { createManualClock, createManualTransport, makeApp, settle } from "./helpers.ts";

const TTL = 15 * 60 * 1000;

test("a quiet system has nothing to reconcile", async () => {
  const app = makeApp();
  await app.orders.place({ customerId: "ann", lines: [{ sku: "WID-1", qty: 2 }] });
  const report = await app.reconciler.run();
  assert.deepEqual([report.expiredReleased, report.orphansReleased, report.drift.length], [0, 0, 0]);
});

test("a reservation whose timer was lost is released once it is past its expiry", async () => {
  const clock = createManualClock();
  const transport = createManualTransport();
  const app = makeApp({ clock, transport });
  const order = await app.orders.place({ customerId: "ann", lines: [{ sku: "WID-1", qty: 2 }] });
  clock.jump(TTL + 1); // the process was down: no timer fired
  const report = await app.reconciler.run();
  assert.equal(report.expiredReleased, 1);
  assert.equal(app.ledger.snapshot("WID-1").available, 20);
  assert.equal((await app.reservations.forOrder(order.id))[0].releaseReason, "reconcile");
});

test("reservations of a cancelled order whose release never ran are released", async () => {
  const transport = createManualTransport();
  const app = makeApp({ transport }); // the cancel event stays queued: its handler never runs
  const order = await app.orders.place({ customerId: "ann", lines: [{ sku: "WID-1", qty: 2 }] });
  await app.orders.cancel(order.id);
  const report = await app.reconciler.run();
  assert.equal(report.orphansReleased, 1);
  assert.equal(app.ledger.snapshot("WID-1").available, 20);
});

test("counters that disagree with the reservation table are corrected and reported", async () => {
  const app = makeApp();
  await app.orders.place({ customerId: "ann", lines: [{ sku: "WID-1", qty: 2 }] });
  app.ledger.repair("WID-1", { reserved: 7, sold: 0 }); // simulate drift
  const report = await app.reconciler.run();
  assert.equal(report.drift.length, 1);
  assert.equal(report.drift[0].sku, "WID-1");
  assert.deepEqual(app.ledger.snapshot("WID-1"), { sku: "WID-1", onHand: 20, available: 18, reserved: 2, sold: 0 });
  await settle();
});
