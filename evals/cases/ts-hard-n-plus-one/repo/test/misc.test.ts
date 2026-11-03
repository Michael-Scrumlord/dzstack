import { test } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../src/api/app.ts";
import { client, FIXED_NOW } from "../testkit/client.ts";
import { smallTeam } from "../testkit/small.ts";

const setup = (token: string) => client(createApp(smallTeam(), { now: FIXED_NOW }), token);

test("/me", async () => {
  assert.deepEqual((await setup("tok-cara").get("/me")).body, {
    user: { id: 3, name: "Cara", email: "cara@example.com" },
    org: { id: 1, role: "member" },
  });
});

test("/tags counts projects per live tag", async () => {
  const body = (await setup("tok-cara").get("/tags")).body as { tags: Array<{ label: string; projects: number }> };
  assert.deepEqual(body.tags.map((t) => [t.label, t.projects]), [["backend", 2], ["Frontend", 2], ["q3", 1]]);
});

test("/digest is for org admins and lists last week's busiest projects", async () => {
  assert.equal((await setup("tok-cara").get("/digest")).status, 403);
  const res = await setup("tok-ada").get("/digest");
  assert.deepEqual(res.body, { since: "2026-02-24T12:00:00Z", busiest: [{ id: 1, name: "Payments", events: 1 }] });
});

test("unknown routes are 404s", async () => {
  assert.equal((await setup("tok-ada").get("/nope")).status, 404);
});
