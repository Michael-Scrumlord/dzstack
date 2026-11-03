import { test } from "node:test";
import assert from "node:assert/strict";
import { createSearchBox, type SearchResult } from "../src/search-box.ts";

const items = (...titles: string[]): SearchResult[] => titles.map((title) => ({ id: title, title }));
const settle = () => new Promise<void>((resolve) => setImmediate(resolve));

test("starts empty", () => {
  const box = createSearchBox(async () => []);
  assert.deepEqual(box.getState(), { query: "", results: [], loading: false, error: null });
});

test("a query loads results", async () => {
  const seen: string[] = [];
  const box = createSearchBox(async (q) => {
    seen.push(q);
    return items("Red mug");
  });
  box.setQuery("  mug ");
  assert.equal(box.getState().loading, true);
  assert.equal(box.getState().query, "  mug ");
  await settle();
  assert.deepEqual(seen, ["mug"]);
  assert.deepEqual(box.getState().results, items("Red mug"));
  assert.equal(box.getState().loading, false);
});

test("a short query sends nothing and clears the results", async () => {
  let calls = 0;
  const box = createSearchBox(async () => {
    calls += 1;
    return items("Red mug");
  });
  box.setQuery("mug");
  await settle();
  box.setQuery("m");
  assert.equal(calls, 1);
  assert.deepEqual(box.getState().results, []);
  assert.equal(box.getState().loading, false);
});

test("a failed request shows the error and no results", async () => {
  const box = createSearchBox(async () => {
    throw new Error("server down");
  });
  box.setQuery("mug");
  await settle();
  assert.equal(box.getState().error, "server down");
  assert.deepEqual(box.getState().results, []);
  assert.equal(box.getState().loading, false);
});

test("listeners hear each change", async () => {
  const box = createSearchBox(async () => items("Red mug"));
  const states: boolean[] = [];
  const stop = box.subscribe((s) => states.push(s.loading));
  box.setQuery("mug");
  await settle();
  stop();
  box.setQuery("mugs");
  assert.deepEqual(states, [true, false]);
});
