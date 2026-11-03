import { test } from "node:test";
import assert from "node:assert/strict";
import { as, bodyOf, createDoc, makeApp } from "./helpers.ts";

test("search finds documents by any word in title, body or tags", async () => {
  const app = makeApp();
  const a = await createDoc(app, "alice", { title: "Quarterly report", body: "Numbers pending", tags: ["finance"] });
  const b = await createDoc(app, "alice", { title: "Offsite", body: "Numbers and food" });
  const alice = as(app, "alice");
  const ids = async (q: string) => bodyOf(await alice("GET", "/search", undefined, { q })).results.map((r: any) => r.id);
  assert.deepEqual(await ids("quarterly"), [a]);
  assert.deepEqual(await ids("numbers"), [a, b]);
  assert.deepEqual(await ids("NUMBERS food"), [b]);
  assert.deepEqual(await ids("finance"), [a]);
  assert.deepEqual(await ids(""), []);
});

test("search follows edits and respects access", async () => {
  const app = makeApp();
  const id = await createDoc(app, "alice", { title: "Secret plan" });
  assert.deepEqual(bodyOf(await as(app, "bob")("GET", "/search", undefined, { q: "secret" })).results, []);
  await as(app, "alice")("PATCH", `/documents/${id}`, { baseVersion: 1, fields: { title: "Public plan" } });
  const hits = bodyOf(await as(app, "alice")("GET", "/search", undefined, { q: "public" })).results;
  assert.deepEqual(hits.map((r: any) => r.id), [id]);
  assert.deepEqual(bodyOf(await as(app, "alice")("GET", "/search", undefined, { q: "secret" })).results, []);
});
