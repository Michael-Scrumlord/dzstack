import { test } from "node:test";
import assert from "node:assert/strict";
import { makeApp, settle } from "./helpers.ts";

test("POST /orders places an order, GET returns it", async () => {
  const app = makeApp();
  const created = await app.api.handle({ method: "POST", path: "/orders", body: { customerId: "ann", lines: [{ sku: "WID-1", qty: 2 }] } });
  assert.equal(created.status, 201);
  const id = (created.body as { id: string }).id;
  const fetched = await app.api.handle({ method: "GET", path: `/orders/${id}` });
  assert.equal(fetched.status, 200);
  assert.equal((fetched.body as { status: string }).status, "pending");
});

test("domain errors map to statuses", async () => {
  const app = makeApp();
  const tooMany = await app.api.handle({ method: "POST", path: "/orders", body: { customerId: "ann", lines: [{ sku: "BOK-3", qty: 99 }] } });
  assert.equal(tooMany.status, 409);
  const invalid = await app.api.handle({ method: "POST", path: "/orders", body: { customerId: "", lines: [] } });
  assert.equal(invalid.status, 400);
  assert.equal((await app.api.handle({ method: "GET", path: "/orders/ord_404" })).status, 404);
  assert.equal((await app.api.handle({ method: "POST", path: "/orders/ord_404/cancel" })).status, 404);
});

test("confirm and cancel go through the order service", async () => {
  const app = makeApp();
  const a = await app.orders.place({ customerId: "ann", lines: [{ sku: "WID-1", qty: 1 }] });
  const b = await app.orders.place({ customerId: "bob", lines: [{ sku: "WID-1", qty: 1 }] });
  assert.equal((await app.api.handle({ method: "POST", path: `/orders/${a.id}/confirm` })).status, 200);
  assert.equal((await app.api.handle({ method: "POST", path: `/orders/${b.id}/cancel` })).status, 200);
  assert.equal((await app.api.handle({ method: "POST", path: `/orders/${a.id}/cancel` })).status, 409);
  await settle();
  assert.deepEqual(app.ledger.snapshot("WID-1"), { sku: "WID-1", onHand: 20, available: 19, reserved: 0, sold: 1 });
});

test("unknown routes and methods", async () => {
  const app = makeApp();
  assert.equal((await app.api.handle({ method: "GET", path: "/nope" })).status, 404);
  assert.equal((await app.api.handle({ method: "DELETE", path: "/orders" })).status, 405);
});

test("GET /stock lists counters and flags problems", async () => {
  const app = makeApp();
  const res = await app.api.handle({ method: "GET", path: "/stock" });
  const body = res.body as { rows: Array<{ sku: string; flags: string[] }>; problems: string[] };
  assert.deepEqual(body.rows.map((r) => r.sku), ["BOK-3", "GAD-2", "WID-1"]);
  assert.deepEqual(body.rows.find((r) => r.sku === "BOK-3")?.flags, ["LOW"]);
  assert.deepEqual(body.problems, []);
  const text = await app.api.handle({ method: "GET", path: "/stock", query: { format: "text" } });
  assert.match(String(text.body), /^SKU +NAME +ON HAND/);
});

test("POST /admin/reconcile runs the reconcile job", async () => {
  const app = makeApp();
  const res = await app.api.handle({ method: "POST", path: "/admin/reconcile" });
  assert.equal(res.status, 200);
  assert.deepEqual((res.body as { drift: unknown[] }).drift, []);
});
