import { test } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../src/api/app.ts";
import { client, FIXED_NOW } from "../testkit/client.ts";
import { smallTeam } from "../testkit/small.ts";

function setup() {
  const db = smallTeam();
  const app = createApp(db, { now: FIXED_NOW });
  return { db, as: (token: string) => client(app, token) };
}
type Listing = { items: Array<{ id: number; name: string; tags: Array<{ label: string }>; latestActivity: { kind: string } | null; memberCount: number }> };

test("creating a project makes the creator its owner and derives a key", async () => {
  const { as, db } = setup();
  const res = await as("tok-cara").post("/projects", { name: "Brand New Thing", visibility: "private" });
  assert.equal(res.status, 201);
  const project = (res.body as { project: { key: string; members: Array<{ name: string; role: string }>; createdAt: string } }).project;
  assert.equal(project.key, "brand-new-thing");
  assert.deepEqual(project.members, [{ id: 3, name: "Cara", role: "owner" }]);
  assert.equal(project.createdAt, "2026-03-03T12:00:00Z");
  assert.equal(db.tables.audit_log.length, 1);
  const listed = (await as("tok-cara").get("/projects", { q: "brand" })).body as Listing;
  assert.equal(listed.items.length, 1);
  assert.equal(((await as("tok-dev").get("/projects", { q: "brand" })).body as Listing).items.length, 0);
});

test("guests cannot create, and names are validated", async () => {
  const { as } = setup();
  assert.equal((await as("tok-eli").post("/projects", { name: "x" })).status, 403);
  assert.equal((await as("tok-ada").post("/projects", { name: "  " })).status, 400);
  assert.equal((await as("tok-ada").post("/projects", { name: "Payments", key: "PAY" })).status, 201);
});

test("editing needs a project role or an org admin", async () => {
  const { as } = setup();
  assert.equal((await as("tok-dev").patch("/projects/1", { name: "Nope" })).status, 403);
  assert.equal((await as("tok-cara").patch("/projects/1", { name: "Payments v2" })).status, 200);
  assert.equal((await as("tok-cara").patch("/projects/1", { pinned: false })).status, 403);
  assert.equal((await as("tok-ben").patch("/projects/1", { pinned: false })).status, 200);
});

test("changes show up in the next listing", async () => {
  const { as } = setup();
  const ada = as("tok-ada");
  await ada.patch("/projects/2", { name: "Apollo 2" });
  await ada.post("/projects/2/tags", { label: "BACKEND" });
  await ada.post("/projects/2/members", { userId: 8, role: "editor" });
  await ada.post("/projects/2/activity", { kind: "comment" });
  const [item] = ((await ada.get("/projects", { q: "apollo" })).body as Listing).items;
  assert.equal(item.name, "Apollo 2");
  assert.deepEqual(item.tags.map((t) => t.label), ["backend", "q3"]);
  assert.equal(item.memberCount, 2);
  assert.equal(item.latestActivity?.kind, "comment");
});

test("page views are recorded but never become the latest activity", async () => {
  const { as } = setup();
  await as("tok-ada").post("/projects/2/activity", { kind: "view" });
  const [item] = ((await as("tok-ada").get("/projects", { q: "apollo" })).body as Listing).items;
  assert.equal(item.latestActivity?.kind, "updated");
  assert.equal((await as("tok-ada").post("/projects/2/activity", { kind: "deleted" })).status, 400);
});

test("members and tags can be removed; deactivated accounts cannot be added", async () => {
  const { as } = setup();
  const ada = as("tok-ada");
  assert.equal((await ada.del("/projects/1/members/4")).status, 200);
  assert.equal((await ada.del("/projects/1/members/4")).status, 404);
  assert.equal((await ada.post("/projects/1/members", { userId: 6 })).status, 409);
  assert.equal((await ada.del("/projects/1/tags/1")).status, 200);
  const [item] = ((await ada.get("/projects", { q: "pay" })).body as Listing).items;
  assert.equal(item.memberCount, 6);
  assert.deepEqual(item.tags.map((t) => t.label), ["Frontend"]);
});
