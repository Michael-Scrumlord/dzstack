import { test } from "node:test";
import assert from "node:assert/strict";
import { createCatalog, isValidSku } from "../src/catalog/catalog.ts";

test("SKUs look like ABC-123", () => {
  assert.ok(isValidSku("WID-1"));
  assert.ok(isValidSku("ABCDEF-12345"));
  for (const bad of ["wid-1", "W-1", "WID1", "WID-", "WID-123456", "WID-1 "]) assert.ok(!isValidSku(bad), bad);
});

test("add validates and get returns copies", () => {
  const catalog = createCatalog();
  assert.throws(() => catalog.add({ sku: "bad", name: "x", priceCents: 1, taxClass: "standard" }), { code: "validation" });
  assert.throws(() => catalog.add({ sku: "WID-1", name: "x", priceCents: 1.5, taxClass: "standard" }), { code: "validation" });
  assert.throws(() => catalog.add({ sku: "WID-1", name: "  ", priceCents: 1, taxClass: "standard" }), { code: "validation" });
  const item = catalog.add({ sku: "WID-1", name: " Widget ", priceCents: 100, taxClass: "standard" });
  assert.equal(item.name, "Widget");
  item.priceCents = 1;
  assert.equal(catalog.get("WID-1").priceCents, 100);
  assert.throws(() => catalog.get("NOP-1"), { code: "not_found" });
});

test("search matches SKU or name, case-insensitively", () => {
  const catalog = createCatalog();
  catalog.add({ sku: "WID-1", name: "Blue widget", priceCents: 100, taxClass: "standard" });
  catalog.add({ sku: "GAD-2", name: "Gadget", priceCents: 100, taxClass: "standard" });
  assert.deepEqual(catalog.search("WIDGET").map((i) => i.sku), ["WID-1"]);
  assert.deepEqual(catalog.search("-2").map((i) => i.sku), ["GAD-2"]);
  assert.deepEqual(catalog.search("  "), []);
});
