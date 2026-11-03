import { test } from "node:test";
import assert from "node:assert/strict";
import { renderSearch } from "../src/render.ts";

test("lists the results", () => {
  const lines = renderSearch({
    query: "mug",
    results: [{ id: "1", title: "Red mug" }, { id: "2", title: "Blue mug" }],
    loading: false,
    error: null,
  });
  assert.deepEqual(lines, ["1. Red mug", "2. Blue mug"]);
});

test("says when nothing matched, and when it failed", () => {
  assert.deepEqual(renderSearch({ query: " zzz ", results: [], loading: false, error: null }), ['No results for "zzz"']);
  assert.deepEqual(renderSearch({ query: "mug", results: [], loading: false, error: "boom" }), ["Search failed: boom"]);
});
