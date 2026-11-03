import { test } from "node:test";
import assert from "node:assert/strict";
import { as, bodyOf, createDoc, makeApp } from "./helpers.ts";

test("requests without a user are refused", async () => {
  const app = makeApp();
  const response = await as(app, undefined)("GET", "/documents");
  assert.equal(response.status, 401);
  assert.equal(bodyOf(response).error, "unauthorized");
});

test("unknown routes and documents are 404", async () => {
  const app = makeApp();
  assert.equal((await as(app, "alice")("GET", "/nope")).status, 404);
  assert.equal((await as(app, "alice")("GET", "/documents/missing")).status, 404);
  assert.equal((await as(app, "alice")("PATCH", "/documents/missing", { baseVersion: 1, fields: { title: "x" } })).status, 404);
});

test("creating validates the body", async () => {
  const app = makeApp();
  const alice = as(app, "alice");
  for (const body of [undefined, {}, { title: "" }, { title: 7 }, { title: "ok", status: "done" }, { title: "ok", tags: ["Bad Tag"] }]) {
    const response = await alice("POST", "/documents", body);
    assert.equal(response.status, 400, JSON.stringify(body));
    assert.equal(bodyOf(response).error, "validation");
  }
});

test("editing validates the body", async () => {
  const app = makeApp();
  const id = await createDoc(app, "alice");
  const alice = as(app, "alice");
  const bad: unknown[] = [
    {},
    { fields: { title: "x" } },
    { baseVersion: "1", fields: { title: "x" } },
    { baseVersion: -1, fields: { title: "x" } },
    { baseVersion: 1, fields: {} },
    { baseVersion: 1, fields: { color: "red" } },
    { baseVersion: 1, fields: { status: "archived" } },
  ];
  for (const body of bad) {
    assert.equal((await alice("PATCH", `/documents/${id}`, body)).status, 400, JSON.stringify(body));
  }
});

test("templates fill in what the caller left out", async () => {
  const app = makeApp();
  const alice = as(app, "alice");
  const made = bodyOf(await alice("POST", "/documents", { title: "Sync", template: "meeting-notes", tags: ["weekly"] }));
  assert.match(made.document.body, /## Agenda/);
  assert.deepEqual(made.document.tags, ["weekly", "meeting"]);
  const own = bodyOf(await alice("POST", "/documents", { title: "Mine", template: "design-doc", body: "just this" }));
  assert.equal(own.document.body, "just this");
  assert.equal((await alice("POST", "/documents", { title: "x", template: "nope" })).status, 400);
});

test("export, stats and tags", async () => {
  const app = makeApp();
  const alice = as(app, "alice");
  const id = await createDoc(app, "alice", { title: "Report", body: "# Intro\nThree small words\n\n## End\nbye", tags: ["ops"] });
  await createDoc(app, "alice", { title: "Other", tags: ["ops", "q4"] });
  const md = bodyOf(await alice("GET", `/documents/${id}/export`)).content as string;
  assert.match(md, /^---\ntitle: "Report"\nstatus: draft\ntags: \[ops\]\nversion: 1\n/);
  assert.match(md, /# Report\n\n# Intro/);
  const txt = bodyOf(await alice("GET", `/documents/${id}/export`, undefined, { format: "txt" })).content as string;
  assert.match(txt, /^Report\n======\n\nIntro\nThree small words/);
  assert.equal((await alice("GET", `/documents/${id}/export`, undefined, { format: "pdf" })).status, 400);
  const { stats } = bodyOf(await alice("GET", `/documents/${id}/stats`));
  assert.deepEqual(stats.headings, ["Intro", "End"]);
  assert.equal(stats.words, 8);
  assert.equal(stats.readingMinutes, 1);
  const { tags } = bodyOf(await alice("GET", "/tags"));
  assert.deepEqual(tags, [{ tag: "ops", count: 2 }, { tag: "q4", count: 1 }]);
});
