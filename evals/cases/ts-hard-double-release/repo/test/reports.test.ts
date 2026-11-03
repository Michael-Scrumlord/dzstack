import { test } from "node:test";
import assert from "node:assert/strict";
import { createCatalog } from "../src/catalog/catalog.ts";
import { buildStockReport, problems, renderStockReport } from "../src/reports/stock-report.ts";
import { table } from "../src/reports/format.ts";

const catalog = createCatalog();
catalog.add({ sku: "WID-1", name: "Widget", priceCents: 100, taxClass: "standard" });

test("rows are flagged LOW, OVERSTATED and MISMATCH", () => {
  const rows = buildStockReport(
    [
      { sku: "WID-1", onHand: 40, available: 46, reserved: 0, sold: 0 },
      { sku: "NOP-9", onHand: 10, available: 2, reserved: 2, sold: 0 },
    ],
    catalog,
    5,
  );
  assert.deepEqual(rows[0].flags, ["OVERSTATED", "MISMATCH"]);
  assert.deepEqual(rows[1].flags, ["LOW", "MISMATCH"]);
  assert.equal(rows[1].name, "(not in catalog)");
  assert.deepEqual(problems(rows).map((r) => r.sku), ["WID-1", "NOP-9"]);
});

test("a healthy row has no flags", () => {
  const rows = buildStockReport([{ sku: "WID-1", onHand: 40, available: 30, reserved: 6, sold: 4 }], catalog, 5);
  assert.deepEqual(rows[0].flags, []);
});

test("the text report lines up its columns", () => {
  const out = renderStockReport(buildStockReport([{ sku: "WID-1", onHand: 40, available: 46, reserved: 0, sold: 0 }], catalog, 5));
  const lines = out.split("\n");
  assert.equal(lines.length, 3);
  assert.match(lines[2], /^WID-1 +Widget +40 +46 +0 +0 +OVERSTATED,MISMATCH$/);
});

test("table pads to the widest cell", () => {
  assert.equal(table(["A", "BB"], [["xxx", "y"]]), "A    BB\n---  --\nxxx  y");
});
