// Docs: inventory-model.md (the counters hold at every moment; a reservation gives its units back exactly once;
// a committed reservation is never released) and events.md (at-least-once delivery, handlers that overlap).
import { test } from "node:test";
import assert from "node:assert/strict";
import { counts, drain, flush, permutations, tableInvariant, tolerate, weakInvariant, world, TTL, type World } from "./support.ts";

const ORDER_A = { customerId: "ann", lines: [{ sku: "WID-1", qty: 4 }] };
const ORDER_B = { customerId: "bob", lines: [{ sku: "WID-1", qty: 3 }] };

async function setup(hops: number) {
  const w = world({ hops });
  const a = await w.app.orders.place(ORDER_A);
  const b = await w.app.orders.place(ORDER_B);
  await flush();
  return { w, a, b };
}

/** Everything a transport and a clock may legitimately do, one step at a time or several in the same tick. */
function operations(w: World, orderId: string) {
  const cancel = () => tolerate(["invalid_transition"], () => w.app.orders.cancel(orderId));
  const confirm = () => tolerate(["reservation_expired", "invalid_transition"], () => w.app.orders.confirm(orderId));
  const ops: Record<string, () => Promise<unknown>> = {
    expire: async () => w.clock.advance(TTL),
    cancel,
    confirm,
    reconcile: () => w.app.reconciler.run(),
    deliver: async () => {
      const next = w.transport.pending()[0];
      if (next) await w.transport.start(next);
    },
    // the transport redelivers everything it ran, runs what is waiting, and reconcile runs, all in the same tick
    storm: () => Promise.all([...w.transport.pending(), ...w.transport.ran()].map((j) => w.transport.start(j)).concat(w.app.reconciler.run().then(() => {}))),
    cancelRace: () => Promise.all([cancel(), w.transport.startAllPending()]),
    confirmRace: () => Promise.all([confirm(), w.transport.startAllPending()]),
  };
  return ops;
}

for (const hops of [0, 2]) {
  test(`cancel, expiry, redelivery and reconcile in every order keep the counters right (warehouse latency ${hops})`, async () => {
    const sequences = permutations(["expire", "cancel", "deliver", "storm", "cancelRace", "reconcile"]);
    assert.equal(sequences.length, 720);
    for (const sequence of sequences) {
      const { w, a } = await setup(hops);
      const ops = operations(w, a.id);
      const label = sequence.join(" > ");
      for (const name of sequence) {
        await ops[name]();
        await flush();
        weakInvariant(w.app, `${label} (after ${name})`);
      }
      await drain(w);
      await tableInvariant(w.app, `${label} (settled)`);
      const reservation = (await w.app.reservations.forOrder(a.id))[0];
      assert.equal(reservation.status, "released", `${label}: the reservation of the cancelled/expired order must be released`);
      assert.ok((w.warehouse.succeeded.get(reservation.id) ?? 0) >= 1, `${label}: the warehouse was never told`);
      // B was never touched by the cancel; it only lives or dies by its own expiry
      const bState = (await w.app.reservations.forOrder((await w.app.orders.list((o) => o.customerId === "bob"))[0].id))[0].status;
      assert.equal(counts(w.app).available, 10 - (bState === "active" ? 3 : 0), `${label}: available stock is wrong`);
    }
  });

  test(`confirm, expiry, redelivery and reconcile in every order never both sell and release a reservation (warehouse latency ${hops})`, async () => {
    for (const sequence of permutations(["expire", "confirm", "deliver", "storm", "confirmRace", "reconcile"])) {
      const { w, a } = await setup(hops);
      const ops = operations(w, a.id);
      const label = sequence.join(" > ");
      let confirmed = false;
      for (const name of sequence) {
        const result = await ops[name]();
        if (name === "confirm" && result === true) confirmed = true;
        if (name === "confirmRace" && (result as unknown[])[0] === true) confirmed = true;
        await flush();
        weakInvariant(w.app, `${label} (after ${name})`);
      }
      await drain(w);
      await tableInvariant(w.app, `${label} (settled)`);
      const status = (await w.app.reservations.forOrder(a.id))[0].status;
      if (confirmed) assert.equal(status, "committed", `${label}: the order was confirmed, so its stock must stay sold`);
      else assert.equal(status, "released", `${label}: the confirmation failed, so its stock must be back`);
    }
  });
}

test("the same cancellation delivered several times at once releases once", async () => {
  for (const hops of [0, 1, 3]) {
    const { w, a } = await setup(hops);
    await w.app.orders.cancel(a.id);
    await flush();
    const jobs = w.transport.ofType("order.cancelled");
    assert.ok(jobs.length >= 1);
    await Promise.all(Array.from({ length: 4 }, () => Promise.all(jobs.map((j) => w.transport.start(j)))));
    await flush();
    await tableInvariant(w.app, `hops ${hops}`);
    assert.deepEqual(counts(w.app), { onHand: 10, available: 7, reserved: 3, sold: 0 });
  }
});

test("the same cancellation delivered again and again after it was handled changes nothing", async () => {
  const { w, a } = await setup(1);
  await w.app.orders.cancel(a.id);
  await flush();
  await drain(w);
  for (let i = 0; i < 3; i++) {
    for (const job of w.transport.jobs) await w.transport.start(job);
    await flush();
    weakInvariant(w.app, `redelivery ${i}`);
  }
  await tableInvariant(w.app, "settled");
  assert.deepEqual(counts(w.app), { onHand: 10, available: 7, reserved: 3, sold: 0 });
});

test("two clicks on Cancel at the same moment release the stock once", async () => {
  const { w, a } = await setup(2);
  await Promise.all([w.app.orders.cancel(a.id), w.app.orders.cancel(a.id)]);
  await flush();
  await Promise.all(w.transport.pending().map((j) => w.transport.start(j)));
  await flush();
  await tableInvariant(w.app, "settled");
  assert.deepEqual(counts(w.app), { onHand: 10, available: 7, reserved: 3, sold: 0 });
});

test("after the dust settles the shop sells exactly what is on the shelf", async () => {
  const { w, a } = await setup(2);
  await w.app.orders.cancel(a.id);
  w.clock.advance(TTL);
  await flush();
  await Promise.all([...w.transport.pending(), ...w.transport.pending()].map((j) => w.transport.start(j)));
  await flush();
  await drain(w);
  await tableInvariant(w.app, "settled");
  // A and B are both gone: all 10 units can be sold, and not an 11th
  await assert.rejects(w.app.orders.place({ customerId: "cy", lines: [{ sku: "WID-1", qty: 11 }] }), { code: "insufficient_stock" });
  const all = await w.app.orders.place({ customerId: "cy", lines: [{ sku: "WID-1", qty: 10 }] });
  assert.equal(all.status, "pending");
  assert.equal(counts(w.app).available, 0);
});
