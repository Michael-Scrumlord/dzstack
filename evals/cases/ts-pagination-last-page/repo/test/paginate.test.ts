import { test } from "node:test";
import assert from "node:assert/strict";
import { paginate } from "../src/paginate.ts";

const range = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

test("splits an exact multiple into full pages", () => {
  const p = paginate(range(40), 2, 20);
  assert.deepEqual(p.items, range(40).slice(20));
  assert.equal(p.totalPages, 2);
  assert.equal(p.hasNext, false);
});

test("rejects page 0", () => {
  assert.throws(() => paginate(range(5), 0, 20), RangeError);
});
