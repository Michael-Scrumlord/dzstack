import { test } from "node:test";
import assert from "node:assert/strict";
import { as, bodyOf, createDoc, makeApp } from "./helpers.ts";

test("comments are added, listed and removed without touching the document", async () => {
  const app = makeApp();
  const id = await createDoc(app, "alice");
  await as(app, "alice")("POST", `/documents/${id}/share`, { userId: "bob", role: "viewer" });
  const before = bodyOf(await as(app, "alice")("GET", `/documents/${id}`)).document;
  const added = await as(app, "bob")("POST", `/documents/${id}/comments`, { text: "  Looks good  " });
  assert.equal(added.status, 201);
  const commentId = bodyOf(added).comment.id;
  const listed = bodyOf(await as(app, "alice")("GET", `/documents/${id}/comments`)).comments;
  assert.deepEqual(listed.map((c: any) => [c.author, c.text]), [["bob", "Looks good"]]);
  const after = bodyOf(await as(app, "alice")("GET", `/documents/${id}`)).document;
  assert.equal(after.version, before.version);
  assert.equal((await as(app, "bob")("DELETE", `/documents/${id}/comments/${commentId}`)).status, 204);
  assert.deepEqual(bodyOf(await as(app, "alice")("GET", `/documents/${id}/comments`)).comments, []);
});

test("only the author or the owner removes a comment, and strangers see nothing", async () => {
  const app = makeApp();
  const id = await createDoc(app, "alice");
  for (const user of ["bob", "carol"]) await as(app, "alice")("POST", `/documents/${id}/share`, { userId: user, role: "viewer" });
  const commentId = bodyOf(await as(app, "bob")("POST", `/documents/${id}/comments`, { text: "hi" })).comment.id;
  assert.equal((await as(app, "carol")("DELETE", `/documents/${id}/comments/${commentId}`)).status, 404);
  assert.equal((await as(app, "mallory")("GET", `/documents/${id}/comments`)).status, 403);
  assert.equal((await as(app, "alice")("DELETE", `/documents/${id}/comments/${commentId}`)).status, 204);
  assert.equal((await as(app, "bob")("POST", `/documents/${id}/comments`, { text: "  " })).status, 400);
});
