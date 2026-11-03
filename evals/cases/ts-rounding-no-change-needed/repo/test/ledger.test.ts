import { test } from "node:test";
import assert from "node:assert/strict";
import { renderLedger } from "../src/ledger.ts";

test("rounds each line half to even and totals the rounded lines", () => {
  const text = renderLedger([
    { memo: "API calls", cents: 2.5 },
    { memo: "Storage", cents: 3.5 },
    { memo: "Support", cents: 120000 },
  ]);
  const lines = text.split("\n");
  assert.match(lines[0], /^API calls\s+\$0\.02$/);
  assert.match(lines[1], /^Storage\s+\$0\.04$/);
  assert.match(lines[2], /^Support\s+\$1,200\.00$/);
  assert.match(lines[4], /^Total\s+\$1,200\.06$/);
});

test("an empty ledger totals zero", () => {
  assert.match(renderLedger([]).split("\n").at(-1) ?? "", /^Total\s+\$0\.00$/);
});
