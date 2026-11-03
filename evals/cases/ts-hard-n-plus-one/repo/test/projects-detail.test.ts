import { test } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../src/api/app.ts";
import { client } from "../testkit/client.ts";
import { smallTeam } from "../testkit/small.ts";

const setup = (token: string) => client(createApp(smallTeam()), token);

test("the detail has the full member list and the latest events", async () => {
  const res = await setup("tok-ada").get("/projects/1");
  assert.equal(res.status, 200);
  const body = res.body as { project: { memberCount: number; members: Array<{ name: string }> }; recentActivity: unknown[] };
  assert.equal(body.project.memberCount, 7);
  assert.deepEqual(body.project.members.map((m) => m.name), ["Ada", "Ben", "Cara", "Dev", "Eli", "Hana", "Ivan"]);
  assert.deepEqual(body.recentActivity, [
    { kind: "comment", at: "2026-03-01T10:00:00Z", actor: "Cara" },
    { kind: "created", at: "2026-01-05T09:00:00Z", actor: "Ada" },
  ]);
});

test("projects the viewer cannot see are 404s", async () => {
  assert.equal((await setup("tok-dev").get("/projects/3")).status, 404);
  assert.equal((await setup("tok-ada").get("/projects/7")).status, 404);
  assert.equal((await setup("tok-ada").get("/projects/999")).status, 404);
  assert.equal((await setup("tok-ada").get("/projects/abc")).status, 400);
});

test("the activity feed pages by time", async () => {
  const api = setup("tok-ada");
  const first = (await api.get("/projects/1/activity", { limit: "1" })).body as { items: Array<{ kind: string }>; next: string | null };
  assert.deepEqual(first.items.map((i) => i.kind), ["comment"]);
  assert.equal(first.next, "2026-03-01T10:00:00Z");
  const second = (await api.get("/projects/1/activity", { limit: "1", before: first.next as string })).body as { items: Array<{ kind: string }>; next: string | null };
  assert.deepEqual(second.items.map((i) => i.kind), ["created"]);
  assert.equal(second.next, null);
});
