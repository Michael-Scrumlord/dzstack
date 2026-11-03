import { test } from "node:test";
import assert from "node:assert/strict";
import { createMemoryPersistence } from "../src/persistence.ts";
import { createDocumentStore } from "../src/store.ts";
import type { DocumentRecord } from "../src/types.ts";

function record(id: string): DocumentRecord {
  return {
    id,
    ownerId: "alice",
    title: "T",
    body: "B",
    status: "draft",
    tags: [],
    version: 1,
    createdAt: 1,
    updatedAt: 1,
    acl: { editors: [], viewers: [] },
  };
}

test("insert, get and save write through to persistence", async () => {
  const persistence = createMemoryPersistence();
  const store = createDocumentStore(persistence);
  await store.insert(record("a"));
  assert.equal((await store.get("a"))?.version, 1);
  const saved = await store.save({ ...(await store.get("a") as DocumentRecord), title: "T2" });
  assert.equal(saved.version, 2);
  assert.equal(persistence.dump()[0]?.title, "T2");
  assert.equal(persistence.dump()[0]?.version, 2);
});

test("a second store over the same persistence sees the documents", async () => {
  const persistence = createMemoryPersistence();
  await createDocumentStore(persistence).insert(record("a"));
  const fresh = createDocumentStore(persistence);
  assert.equal((await fresh.get("a"))?.title, "T");
  assert.equal(await fresh.get("zzz"), undefined);
  assert.deepEqual((await fresh.list()).map((d) => d.id), ["a"]);
});

test("get returns copies", async () => {
  const store = createDocumentStore(createMemoryPersistence());
  await store.insert(record("a"));
  const copy = await store.get("a");
  copy!.tags.push("changed");
  assert.deepEqual((await store.get("a"))?.tags, []);
});

test("inserting an existing id is a conflict", async () => {
  const store = createDocumentStore(createMemoryPersistence());
  await store.insert(record("a"));
  await assert.rejects(() => store.insert(record("a")), { name: "ConflictError" });
});
