import { test } from "node:test";
import assert from "node:assert/strict";
import { createLedger } from "../src/inventory/ledger.ts";

function stocked() {
  const ledger = createLedger();
  ledger.receive("WID-1", 10);
  return ledger;
}

test("receiving stock raises onHand and available", () => {
  const ledger = stocked();
  ledger.receive("WID-1", 5);
  assert.deepEqual(ledger.snapshot("WID-1"), { sku: "WID-1", onHand: 15, available: 15, reserved: 0, sold: 0 });
});

test("reserve moves units from available to reserved", () => {
  const ledger = stocked();
  ledger.reserve("WID-1", 4);
  assert.deepEqual(ledger.snapshot("WID-1"), { sku: "WID-1", onHand: 10, available: 6, reserved: 4, sold: 0 });
});

test("reserve refuses more than is available", () => {
  const ledger = stocked();
  assert.throws(() => ledger.reserve("WID-1", 11), { code: "insufficient_stock" });
  assert.equal(ledger.snapshot("WID-1").available, 10);
});

test("release gives reserved units back", () => {
  const ledger = stocked();
  ledger.reserve("WID-1", 4);
  ledger.release("WID-1", 3);
  assert.deepEqual(ledger.snapshot("WID-1"), { sku: "WID-1", onHand: 10, available: 9, reserved: 1, sold: 0 });
});

test("commit turns reserved units into sold units", () => {
  const ledger = stocked();
  ledger.reserve("WID-1", 4);
  ledger.commit("WID-1", 4);
  assert.deepEqual(ledger.snapshot("WID-1"), { sku: "WID-1", onHand: 10, available: 6, reserved: 0, sold: 4 });
});

test("write-off shrinks onHand and available but not reserved stock", () => {
  const ledger = stocked();
  ledger.reserve("WID-1", 4);
  ledger.writeOff("WID-1", 2);
  assert.deepEqual(ledger.snapshot("WID-1"), { sku: "WID-1", onHand: 8, available: 4, reserved: 4, sold: 0 });
  assert.throws(() => ledger.writeOff("WID-1", 5), { code: "insufficient_stock" });
});

test("quantities must be positive whole numbers", () => {
  const ledger = stocked();
  for (const bad of [0, -1, 1.5, Number.NaN]) assert.throws(() => ledger.reserve("WID-1", bad), { code: "validation" });
});

test("unknown SKUs are not found", () => {
  assert.throws(() => createLedger().snapshot("NOP-1"), { code: "not_found" });
});

test("snapshots are copies", () => {
  const ledger = stocked();
  const snap = ledger.snapshot("WID-1");
  snap.available = 0;
  assert.equal(ledger.snapshot("WID-1").available, 10);
});

test("repair overwrites reserved and sold and recomputes available", () => {
  const ledger = stocked();
  ledger.reserve("WID-1", 4);
  ledger.repair("WID-1", { reserved: 1, sold: 2 });
  assert.deepEqual(ledger.snapshot("WID-1"), { sku: "WID-1", onHand: 10, available: 7, reserved: 1, sold: 2 });
});

test("all() lists SKUs in order", () => {
  const ledger = createLedger();
  ledger.receive("ZED-9", 1);
  ledger.receive("ABC-1", 2);
  assert.deepEqual(ledger.all().map((c) => c.sku), ["ABC-1", "ZED-9"]);
});
