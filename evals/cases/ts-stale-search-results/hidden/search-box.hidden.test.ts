import { test } from "node:test";
import assert from "node:assert/strict";
import * as mod from "../src/search-box.ts";
import { createSearchBox, type SearchResult, type SearchState } from "../src/search-box.ts";

const items = (...titles: string[]): SearchResult[] => titles.map((title) => ({ id: title, title }));
const settle = () => new Promise<void>((resolve) => setImmediate(resolve));

// A fetch whose requests stay pending until the test settles them, in any order.
function controlledFetch() {
  const calls: { query: string; resolve(r: SearchResult[]): void; reject(e: unknown): void }[] = [];
  const fetchResults = (query: string) =>
    new Promise<SearchResult[]>((resolve, reject) => {
      calls.push({ query, resolve, reject });
    });
  return { fetchResults, calls };
}

test("an earlier response that arrives last does not overwrite the newer results", async () => {
  const { fetchResults, calls } = controlledFetch();
  const box = createSearchBox(fetchResults);
  box.setQuery("re");
  box.setQuery("rea");
  assert.deepEqual(calls.map((c) => c.query), ["re", "rea"]);
  calls[1].resolve(items("react"));
  await settle();
  calls[0].resolve(items("red", "reed"));
  await settle();
  assert.deepEqual(box.getState(), { query: "rea", results: items("react"), loading: false, error: null });
});

test("an earlier response that arrives first is dropped and the box keeps waiting", async () => {
  const { fetchResults, calls } = controlledFetch();
  const box = createSearchBox(fetchResults);
  box.setQuery("mu");
  calls[0].resolve(items("mug"));
  await settle();
  box.setQuery("mug");
  box.setQuery("mugs");
  calls[1].resolve(items("old"));
  await settle();
  assert.deepEqual(box.getState(), { query: "mugs", results: items("mug"), loading: true, error: null });
  calls[2].resolve(items("new"));
  await settle();
  assert.deepEqual(box.getState(), { query: "mugs", results: items("new"), loading: false, error: null });
});

test("responses that arrive in order still work", async () => {
  const { fetchResults, calls } = controlledFetch();
  const box = createSearchBox(fetchResults);
  box.setQuery("re");
  calls[0].resolve(items("one"));
  await settle();
  assert.deepEqual(box.getState().results, items("one"));
  box.setQuery("rea");
  calls[1].resolve(items("two"));
  await settle();
  assert.deepEqual(box.getState(), { query: "rea", results: items("two"), loading: false, error: null });
});

test("with three requests, the last one typed wins whatever the order", async () => {
  const { fetchResults, calls } = controlledFetch();
  const box = createSearchBox(fetchResults);
  box.setQuery("re");
  box.setQuery("rea");
  box.setQuery("reac");
  calls[2].resolve(items("C"));
  await settle();
  calls[0].resolve(items("A"));
  await settle();
  calls[1].resolve(items("B"));
  await settle();
  assert.deepEqual(box.getState().results, items("C"));
  assert.equal(box.getState().loading, false);
});

test("an error from an earlier request does not clobber the newer results", async () => {
  const { fetchResults, calls } = controlledFetch();
  const box = createSearchBox(fetchResults);
  box.setQuery("re");
  box.setQuery("rea");
  calls[1].resolve(items("react"));
  await settle();
  calls[0].reject(new Error("timeout"));
  await settle();
  assert.deepEqual(box.getState(), { query: "rea", results: items("react"), loading: false, error: null });
});

test("an error from an earlier request does not stop the spinner or set an error", async () => {
  const { fetchResults, calls } = controlledFetch();
  const box = createSearchBox(fetchResults);
  box.setQuery("re");
  box.setQuery("rea");
  calls[0].reject(new Error("timeout"));
  await settle();
  assert.deepEqual(box.getState(), { query: "rea", results: [], loading: true, error: null });
  calls[1].resolve(items("react"));
  await settle();
  assert.deepEqual(box.getState(), { query: "rea", results: items("react"), loading: false, error: null });
});

test("an error from the latest request still shows, and a later arrival from an earlier one does not hide it", async () => {
  const { fetchResults, calls } = controlledFetch();
  const box = createSearchBox(fetchResults);
  box.setQuery("re");
  box.setQuery("rea");
  calls[1].reject(new Error("server down"));
  await settle();
  assert.deepEqual(box.getState(), { query: "rea", results: [], loading: false, error: "server down" });
  calls[0].resolve(items("red"));
  await settle();
  assert.deepEqual(box.getState(), { query: "rea", results: [], loading: false, error: "server down" });
  calls[0].reject(new Error("other"));
  await settle();
  assert.equal(box.getState().error, "server down");
});

test("clearing the box while a request is in flight ignores that request's answer", async () => {
  const { fetchResults, calls } = controlledFetch();
  const box = createSearchBox(fetchResults);
  box.setQuery("re");
  box.setQuery("r");
  assert.deepEqual(box.getState(), { query: "r", results: [], loading: false, error: null });
  calls[0].resolve(items("red"));
  await settle();
  assert.deepEqual(box.getState(), { query: "r", results: [], loading: false, error: null });
});

test("clearing the box also ignores a late error", async () => {
  const { fetchResults, calls } = controlledFetch();
  const box = createSearchBox(fetchResults);
  box.setQuery("re");
  box.setQuery("");
  calls[0].reject(new Error("timeout"));
  await settle();
  assert.deepEqual(box.getState(), { query: "", results: [], loading: false, error: null });
});

test("typing the same text again makes the newer request the one that counts", async () => {
  const { fetchResults, calls } = controlledFetch();
  const box = createSearchBox(fetchResults);
  box.setQuery("re");
  box.setQuery("rea");
  box.setQuery("re");
  assert.equal(calls.length, 3);
  calls[2].resolve(items("newest"));
  await settle();
  calls[0].resolve(items("first"));
  await settle();
  calls[1].resolve(items("second"));
  await settle();
  assert.deepEqual(box.getState(), { query: "re", results: items("newest"), loading: false, error: null });
});

test("clearing and typing the same text again: only the newer request counts", async () => {
  const { fetchResults, calls } = controlledFetch();
  const box = createSearchBox(fetchResults);
  box.setQuery("re");
  box.setQuery("r");
  box.setQuery("re");
  calls[1].resolve(items("second"));
  await settle();
  calls[0].resolve(items("first"));
  await settle();
  assert.deepEqual(box.getState().results, items("second"));
});

test("an answer to an earlier request does not notify listeners", async () => {
  const { fetchResults, calls } = controlledFetch();
  const box = createSearchBox(fetchResults);
  box.setQuery("re");
  box.setQuery("rea");
  const seen: SearchState[] = [];
  box.subscribe((s) => seen.push(s));
  calls[0].resolve(items("red"));
  await settle();
  calls[0].reject(new Error("late"));
  await settle();
  assert.equal(seen.length, 0);
  calls[1].resolve(items("react"));
  await settle();
  assert.equal(seen.length, 1);
  assert.deepEqual(seen[0].results, items("react"));
});

test("two search boxes do not interfere with each other", async () => {
  const a = controlledFetch();
  const b = controlledFetch();
  const header = createSearchBox(a.fetchResults);
  const catalog = createSearchBox(b.fetchResults);
  header.setQuery("mug");
  catalog.setQuery("lamp");
  a.calls[0].resolve(items("mug"));
  await settle();
  b.calls[0].resolve(items("lamp"));
  await settle();
  assert.deepEqual(header.getState(), { query: "mug", results: items("mug"), loading: false, error: null });
  assert.deepEqual(catalog.getState(), { query: "lamp", results: items("lamp"), loading: false, error: null });
});

test("the public API is unchanged", async () => {
  assert.equal(typeof mod.createSearchBox, "function");
  const { fetchResults, calls } = controlledFetch();
  const box = createSearchBox(fetchResults, { minLength: 3 });
  for (const method of ["getState", "setQuery", "subscribe"] as const) assert.equal(typeof box[method], "function", method);
  assert.deepEqual(Object.keys(box.getState()).sort(), ["error", "loading", "query", "results"]);
  box.setQuery("ab");
  assert.equal(calls.length, 0);
  box.setQuery("  abc ");
  assert.deepEqual(calls.map((c) => c.query), ["abc"]);
  assert.equal(box.getState().query, "  abc ");
  const stop = box.subscribe(() => {});
  assert.equal(typeof stop, "function");
  const snapshot = box.getState();
  snapshot.results.push({ id: "x", title: "x" });
  assert.deepEqual(box.getState().results, []);
});
