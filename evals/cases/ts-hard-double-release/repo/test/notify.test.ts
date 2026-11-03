import { test } from "node:test";
import assert from "node:assert/strict";
import { makeApp, settle } from "./helpers.ts";
import { hasTemplate, render } from "../src/notify/templates.ts";

test("customers hear about confirmed and cancelled orders", async () => {
  const app = makeApp();
  const a = await app.orders.place({ customerId: "ann", lines: [{ sku: "WID-1", qty: 1 }] });
  const b = await app.orders.place({ customerId: "bob", lines: [{ sku: "WID-1", qty: 1 }] });
  await app.orders.confirm(a.id);
  await app.orders.cancel(b.id);
  await settle();
  assert.deepEqual(app.notifier.outbox.map((m) => [m.to, m.subject]), [
    ["ann", `Order ${a.id} confirmed`],
    ["bob", `Order ${b.id} cancelled`],
  ]);
});

test("templates exist for the order status events only", () => {
  assert.ok(hasTemplate("order.expired"));
  assert.ok(!hasTemplate("order.placed"));
  assert.throws(() => render("order.placed", { orderId: "ord_1" }));
});

test("the audit log records every event", async () => {
  const app = makeApp();
  const order = await app.orders.place({ customerId: "ann", lines: [{ sku: "WID-1", qty: 1 }] });
  await app.orders.cancel(order.id);
  await settle();
  const entries = await app.store.audit.list();
  const types = entries.map((e) => e.type);
  assert.ok(types.includes("order.placed") && types.includes("order.cancelled") && types.includes("reservation.released"));
});
