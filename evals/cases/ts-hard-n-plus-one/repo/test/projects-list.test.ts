import { test } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../src/api/app.ts";
import { client } from "../testkit/client.ts";
import { smallTeam } from "../testkit/small.ts";

const setup = (token: string) => client(createApp(smallTeam()), token);
type Item = { id: number; name: string; members: Array<{ name: string; role: string }>; [k: string]: unknown };
type Listing = { items: Item[]; page: number; perPage: number; total: number; totalPages: number; hasNext: boolean };
const names = (body: unknown) => (body as Listing).items.map((i) => i.name);

test("an org owner sees every live project, pinned first, then by name", async () => {
  const res = await setup("tok-ada").get("/projects");
  assert.equal(res.status, 200);
  assert.deepEqual(names(res.body), ["Payments", "apollo", "Billing", "website", "Zephyr"]);
});

test("members see org projects and the private ones they belong to", async () => {
  assert.deepEqual(names((await setup("tok-cara").get("/projects")).body), ["Payments", "apollo", "Billing", "Zephyr"]);
  assert.deepEqual(names((await setup("tok-dev").get("/projects")).body), ["Payments", "apollo", "website", "Zephyr"]);
});

test("guests see only the projects they belong to", async () => {
  assert.deepEqual(names((await setup("tok-eli").get("/projects")).body), ["Payments", "website"]);
});

test("another org's projects never show", async () => {
  const body = (await setup("tok-gus").get("/projects")).body as Listing;
  assert.deepEqual(body.items.map((i) => i.id), [7]);
});

test("archived projects are hidden unless asked for", async () => {
  const api = setup("tok-ada");
  assert.ok(!names((await api.get("/projects")).body).includes("Archive 2024"));
  assert.ok(names((await api.get("/projects", { includeArchived: "true" })).body).includes("Archive 2024"));
});

test("an item has the documented shape", async () => {
  const body = (await setup("tok-ada").get("/projects", { q: "pay" })).body as Listing;
  assert.deepEqual(body.items[0], {
    id: 1,
    key: "PAY",
    name: "Payments",
    description: "Card and invoice flows",
    visibility: "org",
    pinned: true,
    archived: false,
    createdAt: "2026-01-05T09:00:00Z",
    updatedAt: "2026-03-01T10:00:00Z",
    memberCount: 7,
    members: [
      { id: 1, name: "Ada", role: "owner" },
      { id: 2, name: "Ben", role: "admin" },
      { id: 3, name: "Cara", role: "editor" },
      { id: 4, name: "Dev", role: "viewer" },
      { id: 5, name: "Eli", role: "viewer" },
    ],
    tags: [
      { label: "backend", color: "blue" },
      { label: "Frontend", color: "gray" },
    ],
    latestActivity: { kind: "comment", at: "2026-03-01T10:00:00Z", actor: "Cara" },
  });
});

test("deactivated members are left out of the list and the count", async () => {
  const [payments] = ((await setup("tok-ada").get("/projects", { q: "pay" })).body as Listing).items;
  assert.ok(!payments.members.some((m) => m.name === "Fay"));
  assert.equal(payments.memberCount, 7);
});

test("latest activity skips page views and names the actor, including deactivated ones", async () => {
  const items = ((await setup("tok-ada").get("/projects")).body as Listing).items;
  const byName = Object.fromEntries(items.map((i) => [i.name, i.latestActivity]));
  assert.deepEqual(byName["apollo"], { kind: "updated", at: "2026-02-10T09:00:00Z", actor: "Fay" });
  assert.deepEqual(byName["website"], { kind: "file_added", at: "2026-02-01T09:00:00Z", actor: "System" });
  assert.equal(byName["Billing"], null);
});

test("pagination", async () => {
  const api = setup("tok-ada");
  const first = (await api.get("/projects", { perPage: "2" })).body as Listing;
  assert.deepEqual([names(first), first.total, first.totalPages, first.hasNext], [["Payments", "apollo"], 5, 3, true]);
  const last = (await api.get("/projects", { perPage: "2", page: "3" })).body as Listing;
  assert.deepEqual([names(last), last.hasNext], [["Zephyr"], false]);
  const past = (await api.get("/projects", { perPage: "2", page: "4" })).body as Listing;
  assert.deepEqual([past.items, past.total, past.totalPages, past.hasNext], [[], 5, 3, false]);
});

test("search matches name or key, ignoring case", async () => {
  const api = setup("tok-ada");
  assert.deepEqual(names((await api.get("/projects", { q: "PAY" })).body), ["Payments"]);
  assert.deepEqual(names((await api.get("/projects", { q: " site " })).body), ["website"]);
  assert.deepEqual(names((await api.get("/projects", { q: "nothing" })).body), []);
});

test("tag filter matches live tags by label, ignoring case", async () => {
  const api = setup("tok-ada");
  assert.deepEqual(names((await api.get("/projects", { tag: "BACKEND" })).body), ["Payments", "Billing"]);
  assert.deepEqual(names((await api.get("/projects", { tag: "urgent" })).body), []);
});

test("sorting by creation date, newest first, keeps pinned projects on top", async () => {
  const res = await setup("tok-ada").get("/projects", { sort: "created", order: "desc" });
  assert.deepEqual(names(res.body), ["Payments", "Zephyr", "website", "Billing", "apollo"]);
});

test("bad parameters are rejected, and a big perPage is capped", async () => {
  const api = setup("tok-ada");
  const bad = await api.get("/projects", { page: "0" });
  assert.equal(bad.status, 400);
  assert.deepEqual(bad.body, { error: { code: "invalid_query", message: "page must be a positive integer" } });
  assert.equal(((await api.get("/projects", { perPage: "1000" })).body as Listing).perPage, 100);
});

test("a request without a known token is a 401", async () => {
  const res = await setup("nope").get("/projects");
  assert.equal(res.status, 401);
});
