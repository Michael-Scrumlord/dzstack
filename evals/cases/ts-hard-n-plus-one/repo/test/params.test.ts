import { test } from "node:test";
import assert from "node:assert/strict";
import { HttpError } from "../src/lib/errors.ts";
import { parseListQuery } from "../src/lib/params.ts";

test("defaults", () => {
  assert.deepEqual(parseListQuery({}), {
    page: 1, perPage: 20, sort: "name", order: "asc", q: "", tag: "", includeArchived: false,
  });
});

test("values are read, trimmed and clamped", () => {
  const q = parseListQuery({ page: "3", perPage: "500", sort: "updated", order: "desc", q: "  Pay ", tag: " Backend", includeArchived: "true" });
  assert.deepEqual(q, { page: 3, perPage: 100, sort: "updated", order: "desc", q: "Pay", tag: "Backend", includeArchived: true });
});

test("bad values are 400s", () => {
  for (const bad of [{ page: "0" }, { page: "-1" }, { page: "x" }, { perPage: "1.5" }, { sort: "size" }, { order: "up" }, { includeArchived: "yes" }]) {
    assert.throws(() => parseListQuery(bad), (e) => e instanceof HttpError && e.status === 400 && e.code === "invalid_query");
  }
});
