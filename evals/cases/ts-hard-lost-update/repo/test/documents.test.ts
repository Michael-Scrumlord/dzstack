import { test } from "node:test";
import assert from "node:assert/strict";
import { as, bodyOf, createDoc, makeApp } from "./helpers.ts";

test("a new document starts at version 1 and is logged", async () => {
  const app = makeApp();
  const alice = as(app, "alice");
  const response = await alice("POST", "/documents", { title: "  Plan  ", tags: ["Q4", "q4", "ops"] });
  assert.equal(response.status, 201);
  const { document } = bodyOf(response);
  assert.equal(document.title, "Plan");
  assert.deepEqual(document.tags, ["q4", "ops"]);
  assert.equal(document.version, 1);
  assert.equal(document.status, "draft");
  assert.deepEqual(app.audit.entries().map((e) => [e.action, e.version]), [["create", 1]]);
});

test("an edit changes the fields it names and raises the version", async () => {
  const app = makeApp();
  const id = await createDoc(app, "alice");
  const response = await as(app, "alice")("PATCH", `/documents/${id}`, {
    baseVersion: 1,
    fields: { title: "Plan v2", status: "review" },
  });
  assert.equal(response.status, 200);
  const { document } = bodyOf(response);
  assert.equal(document.title, "Plan v2");
  assert.equal(document.body, "Draft");
  assert.equal(document.status, "review");
  assert.equal(document.version, 2);
  const read = bodyOf(await as(app, "alice")("GET", `/documents/${id}`));
  assert.equal(read.document.version, 2);
});

test("consecutive edits by the same person each produce a version and an audit entry", async () => {
  const app = makeApp();
  const id = await createDoc(app, "alice");
  const alice = as(app, "alice");
  await alice("PATCH", `/documents/${id}`, { baseVersion: 1, fields: { title: "A" } });
  await alice("PATCH", `/documents/${id}`, { baseVersion: 2, fields: { body: "B" } });
  const entries = app.audit.entries({ documentId: id });
  assert.deepEqual(entries.map((e) => [e.seq, e.action, e.version]), [[1, "create", 1], [2, "edit", 2], [3, "edit", 3]]);
  assert.deepEqual(entries[2]?.fields, { body: "B" });
  assert.equal(entries[2]?.actor, "alice");
});

test("sharing gives access and is a versioned, logged change", async () => {
  const app = makeApp();
  const id = await createDoc(app, "alice");
  assert.equal((await as(app, "bob")("GET", `/documents/${id}`)).status, 403);
  const shared = await as(app, "alice")("POST", `/documents/${id}/share`, { userId: "bob", role: "editor" });
  assert.equal(shared.status, 200);
  assert.equal(bodyOf(shared).document.version, 2);
  assert.equal((await as(app, "bob")("GET", `/documents/${id}`)).status, 200);
  assert.equal((await as(app, "bob")("PATCH", `/documents/${id}`, { baseVersion: 2, fields: { body: "by bob" } })).status, 200);
  assert.equal((await as(app, "bob")("POST", `/documents/${id}/share`, { userId: "carol", role: "viewer" })).status, 403);
  assert.deepEqual(app.audit.entries({ documentId: id }).map((e) => e.action), ["create", "share", "edit"]);
});

test("a viewer can read but not edit", async () => {
  const app = makeApp();
  const id = await createDoc(app, "alice");
  await as(app, "alice")("POST", `/documents/${id}/share`, { userId: "vic", role: "viewer" });
  assert.equal((await as(app, "vic")("GET", `/documents/${id}`)).status, 200);
  const edit = await as(app, "vic")("PATCH", `/documents/${id}`, { baseVersion: 2, fields: { title: "nope" } });
  assert.equal(edit.status, 403);
});

test("the document list shows only what the user may see, oldest first", async () => {
  const app = makeApp();
  const first = await createDoc(app, "alice", { title: "First" });
  await createDoc(app, "bob", { title: "Bob's" });
  const third = await createDoc(app, "alice", { title: "Third" });
  await as(app, "bob")("POST", `/documents/${third}/share`, { userId: "bob", role: "viewer" }); // not the owner: refused
  const titles = (user: string) => as(app, user)("GET", "/documents").then((r) => bodyOf(r).documents.map((d: any) => d.title));
  assert.deepEqual(await titles("alice"), ["First", "Third"]);
  assert.deepEqual(await titles("bob"), ["Bob's"]);
  assert.ok(first);
});

test("the audit endpoint lists a document's entries", async () => {
  const app = makeApp();
  const id = await createDoc(app, "alice");
  await as(app, "alice")("PATCH", `/documents/${id}`, { baseVersion: 1, fields: { tags: ["x"] } });
  const response = await as(app, "alice")("GET", `/documents/${id}/audit`);
  assert.equal(response.status, 200);
  assert.deepEqual(bodyOf(response).entries.map((e: any) => e.action), ["create", "edit"]);
});
