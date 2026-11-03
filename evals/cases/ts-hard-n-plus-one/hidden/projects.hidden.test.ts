// Hidden checks for the projects listing. The oracle is the original implementation
// (the fixture as the agent first saw it, copied to ../oracle/src by check.sh); the
// agent's app must answer every request exactly as the oracle does, on a database
// that gets written to between requests, within the query budget of docs/performance.md.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createApp as createAgentApp } from "../src/api/app.ts";
import { createApp as createOracleApp } from "../oracle/src/api/app.ts";
import type { App } from "../src/api/app.ts";
import type { FakeDb } from "../src/db/fake.ts";
import { TOKENS, cloneDb, makeTeam } from "./gen.ts";

const NOW = () => new Date("2026-03-03T12:00:00Z");
const MAX_QUERIES = 12;
const MAX_MS = 150;

interface Req {
  method?: string;
  path: string;
  query?: Record<string, string>;
  token: string;
  body?: unknown;
}
type Wire = { status: number; body: any };

const call = (app: App, r: Req) =>
  app
    .handle({ method: r.method ?? "GET", path: r.path, query: r.query, body: r.body, headers: { authorization: `Bearer ${r.token}` } })
    .then((res) => JSON.parse(JSON.stringify(res)) as Wire);
const list = (token: string, query: Record<string, string> = {}): Req => ({ path: "/projects", token, query });

class Pair {
  agentDb: FakeDb;
  oracleDb: FakeDb;
  agent: App;
  oracle: App;
  constructor(team: FakeDb) {
    this.agentDb = cloneDb(team);
    this.oracleDb = cloneDb(team);
    this.agent = createAgentApp(this.agentDb, { now: NOW });
    this.oracle = createOracleApp(this.oracleDb, { now: NOW });
  }
  /** Ask both; they must answer alike. Returns the oracle's answer. */
  async same(r: Req): Promise<Wire> {
    const [a, o] = await Promise.all([call(this.agent, r), call(this.oracle, r)]);
    const where = `${r.method ?? "GET"} ${r.path} ${JSON.stringify(r.query ?? {})} as ${r.token}`;
    assert.deepStrictEqual(a, o, `response differs from the original for ${where}`);
    return o;
  }
  /** Change both databases the same way, behind the API's back (another service writing). */
  async both(fn: (db: FakeDb) => Promise<unknown>): Promise<void> {
    await fn(this.agentDb);
    await fn(this.oracleDb);
  }
}

const VIEWERS = Object.values(TOKENS);
const team150 = makeTeam({ projects: 150, seed: 11 });

test("the generated data really contains the edge cases the other checks rely on", async () => {
  const p = new Pair(team150);
  const items: any[] = [];
  for (let page = 1; page <= 2; page++) {
    const res = await p.same(list(TOKENS.owner, { perPage: "100", page: String(page), includeArchived: "true" }));
    items.push(...res.body.items);
  }
  const has = (label: string, f: (i: any) => boolean) => assert.ok(items.some(f), `no item with ${label}`);
  has("no members", (i) => i.memberCount === 0 && i.members.length === 0);
  has("more than five members", (i) => i.memberCount > 5 && i.members.length === 5);
  has("no tags", (i) => i.tags.length === 0);
  has("a gray tag", (i) => i.tags.some((t: any) => t.color === "gray"));
  has("two tags that differ only in case", (i) => new Set(i.tags.map((t: any) => t.label.toLowerCase())).size < i.tags.length);
  has("no activity", (i) => i.latestActivity === null);
  has("a system actor", (i) => i.latestActivity?.actor === "System");
  has("an unknown actor", (i) => i.latestActivity?.actor === "Unknown");
  has("a pinned project", (i) => i.pinned);
  has("an archived project", (i) => i.archived);
  has("a private project", (i) => i.visibility === "private");
  const names = items.map((i) => i.name.toLowerCase());
  assert.ok(names.length > new Set(names).size, "no names tie ignoring case");
});

test("every viewer, sort, order and archive flag gives the same pages as the original", async () => {
  const p = new Pair(team150);
  let seen = 0;
  for (const token of VIEWERS) {
    for (const sort of ["name", "created", "updated"]) {
      for (const order of ["asc", "desc"]) {
        for (const includeArchived of ["false", "true"]) {
          const base = { perPage: "7", sort, order, includeArchived };
          const first = await p.same(list(token, { ...base, page: "1" }));
          seen += first.body.items.length;
          const last = first.body.totalPages;
          const pages = new Set([2, Math.ceil(last / 2), last, last + 1].filter((n) => n >= 1));
          for (const page of pages) await p.same(list(token, { ...base, page: String(page) }));
        }
      }
    }
  }
  assert.ok(seen > 500, `only ${seen} items compared`);
});

test("page sizes and page edges", async () => {
  const p = new Pair(team150);
  for (const token of [TOKENS.owner, TOKENS.member, TOKENS.guest, TOKENS.emptyOrg]) {
    for (const perPage of ["1", "2", "20", "99", "100", "101", "1000"]) {
      const first = await p.same(list(token, { perPage, includeArchived: "true" }));
      const last = first.body.totalPages;
      for (const page of new Set([1, 2, last, last + 1, 9999])) {
        if (page >= 1) await p.same(list(token, { perPage, page: String(page), includeArchived: "true" }));
      }
    }
    await p.same(list(token, { page: "9007199254740991", perPage: "100" }));
    await p.same(list(token));
  }
  const empty = await p.same(list(TOKENS.emptyOrg));
  assert.deepStrictEqual(empty.body, { items: [], page: 1, perPage: 20, total: 0, totalPages: 0, hasNext: false });
});

test("search and tag filters, including text that looks like a pattern", async () => {
  const p = new Pair(team150);
  const searches = ["a", "A", "alp", "ALPHA", "  alpha  ", "%", "_", "\\", "100%", "100", "a_b", "a%b", "a%", "_b", "back\\sl", "\\s", "ü", "Ünï", "ÜNÏCODE", "k1", "K1", "BILLING", "-1", "zzzz", "x", "ALPHA 1", ".", "*", "(", "a.b", "[a]"];
  for (const q of searches) {
    for (const token of [TOKENS.owner, TOKENS.member2, TOKENS.guest]) {
      await p.same(list(token, { q, perPage: "100" }));
    }
    await p.same(list(TOKENS.admin, { q, perPage: "9", page: "2", sort: "name", order: "desc", includeArchived: "true" }));
  }
  const tags = ["backend", "BACKEND", "Backend", "frontend", "front_end", "front%", "%", "_", "100%", "a\\b", "urgent", "q3", "Q3", "design", "nonexistent", " ops ", "b.ckend", "back"];
  for (const tag of tags) {
    for (const token of [TOKENS.owner, TOKENS.member, TOKENS.lonely, TOKENS.guest, TOKENS.otherOrg]) {
      await p.same(list(token, { tag, perPage: "100" }));
    }
    await p.same(list(TOKENS.owner, { tag, perPage: "5", page: "2", sort: "created", order: "desc", includeArchived: "true" }));
  }
  for (const [q, tag] of [["a", "backend"], ["pro", "q3"], ["%", "100%"], ["alpha", "BACKEND"]]) {
    for (const token of [TOKENS.owner, TOKENS.member]) {
      await p.same(list(token, { q, tag, perPage: "50", sort: "updated", order: "desc", includeArchived: "true" }));
    }
  }
  const hit = await p.same(list(TOKENS.owner, { tag: "backend", perPage: "100" }));
  assert.ok(hit.body.total > 3, "the tag filter should match several projects");
  const pct = await p.same(list(TOKENS.owner, { q: "100%", perPage: "100", includeArchived: "true" }));
  assert.ok(pct.body.items.every((i: any) => (i.name + i.key).toLowerCase().includes("100%")));
});

test("bad parameters get the same error responses", async () => {
  const p = new Pair(team150);
  const bad: Array<Record<string, string>> = [
    { page: "0" }, { page: "-3" }, { page: "abc" }, { page: "1.5" }, { perPage: "0" }, { perPage: "x" },
    { sort: "size" }, { order: "up" }, { includeArchived: "maybe" }, { page: "2", perPage: "-1" },
  ];
  for (const query of bad) {
    const res = await p.same(list(TOKENS.owner, query));
    assert.equal(res.status, 400);
  }
  assert.equal((await p.same({ path: "/projects", token: "wrong" })).status, 401);
});

test("the other endpoints answer as before", async () => {
  const p = new Pair(team150);
  for (const token of [TOKENS.owner, TOKENS.member, TOKENS.guest, TOKENS.otherOrg, TOKENS.emptyOrg]) {
    for (let id = 1; id <= 180; id += id < 40 ? 1 : 7) await p.same({ path: `/projects/${id}`, token });
    await p.same({ path: "/projects/99999", token });
    await p.same({ path: "/tags", token });
    await p.same({ path: "/me", token });
    await p.same({ path: "/digest", token });
  }
  for (const id of [1, 2, 3, 10, 22, 33, 44, 100]) {
    await p.same({ path: `/projects/${id}/activity`, token: TOKENS.owner, query: { limit: "4" } });
    await p.same({ path: `/projects/${id}/activity`, token: TOKENS.owner, query: { limit: "4", before: "2025-01-25T08:00:00Z" } });
  }
});

test("a listing costs a bounded number of queries, whatever the page and the team", async () => {
  const db = makeTeam({ projects: 800, seed: 5 });
  const variants: Array<Record<string, string>> = [
    { perPage: "50", page: "1" }, { perPage: "50", page: "3" }, { perPage: "5", page: "1" }, { perPage: "5", page: "40" },
    { perPage: "100", page: "1" }, { perPage: "100", page: "2" }, { perPage: "1", page: "1" }, { perPage: "20" },
    { perPage: "100", q: "a", sort: "updated", order: "desc", includeArchived: "true" },
    { perPage: "50", tag: "backend" }, { perPage: "50", tag: "BACKEND", q: "pro" },
  ];
  const viewers = [TOKENS.owner, TOKENS.admin, TOKENS.member, TOKENS.member2, TOKENS.lonely, TOKENS.guest];
  for (const token of viewers) {
    for (const query of variants) {
      db.resetStats();
      const res = await call(createAgentApp(db, { now: NOW }), list(token, query));
      const label = `${token} ${JSON.stringify(query)}`;
      assert.equal(res.status, 200, label);
      assert.ok(db.stats.queries <= MAX_QUERIES, `${db.stats.queries} queries for ${label}\n${db.log.slice(0, 14).join("\n")}`);
      assert.ok(db.stats.simulatedMs < MAX_MS, `${db.stats.simulatedMs.toFixed(0)} ms simulated for ${label} (${db.stats.queries} queries, ${db.stats.rowsRead} rows)`);
    }
    db.resetStats();
    const past = await call(createAgentApp(db, { now: NOW }), list(token, { perPage: "20", page: "9999" }));
    assert.deepStrictEqual(past.body.items, []);
    assert.ok(db.stats.queries <= MAX_QUERIES, `${db.stats.queries} queries for a page past the end`);
  }
});

test("a big team's pages match the original too", async () => {
  const p = new Pair(makeTeam({ projects: 800, seed: 5 }));
  for (const token of [TOKENS.owner, TOKENS.member, TOKENS.guest]) {
    for (let page = 1; page <= 9; page += 2) await p.same(list(token, { perPage: "100", page: String(page), includeArchived: "true" }));
    await p.same(list(token, { perPage: "50", page: "4", sort: "created", order: "desc" }));
    await p.same(list(token, { perPage: "50", q: "mo", tag: "backend", sort: "updated" }));
  }
});

// ---- no stale data ----

async function reads(p: Pair, id: number, extra: Req[] = []): Promise<void> {
  const set: Req[] = [
    list(TOKENS.owner, { perPage: "10" }),
    list(TOKENS.owner, { perPage: "10", sort: "updated", order: "desc" }),
    list(TOKENS.owner, { perPage: "100", includeArchived: "true" }),
    list(TOKENS.owner, { tag: "backend", perPage: "100" }),
    list(TOKENS.owner, { tag: "brand new tag", perPage: "100" }),
    list(TOKENS.owner, { q: "renamed", perPage: "100" }),
    list(TOKENS.member, { perPage: "30", includeArchived: "true" }),
    list(TOKENS.member2, { perPage: "30" }),
    list(TOKENS.guest, { perPage: "30" }),
    { path: `/projects/${id}`, token: TOKENS.owner },
    ...extra,
  ];
  for (const r of set) await p.same(r);
}

test("a write made through the API shows up in the very next listing", async () => {
  const p = new Pair(team150);
  const first = await p.same(list(TOKENS.owner, { perPage: "10" }));
  const x: number = first.body.items[first.body.items.length - 1].id;
  await reads(p, x); // warm everything
  const writes: Req[] = [
    { method: "PATCH", path: `/projects/${x}`, token: TOKENS.owner, body: { name: "Zz renamed project" } },
    { method: "PATCH", path: `/projects/${x}`, token: TOKENS.owner, body: { pinned: true } },
    { method: "POST", path: `/projects/${x}/tags`, token: TOKENS.owner, body: { label: "BACKEND" } },
    { method: "POST", path: `/projects/${x}/tags`, token: TOKENS.owner, body: { label: "brand new tag" } },
    { method: "POST", path: `/projects/${x}/members`, token: TOKENS.owner, body: { userId: 4, role: "owner" } },
    { method: "POST", path: `/projects/${x}/members`, token: TOKENS.owner, body: { userId: 3, role: "editor" } },
    { method: "POST", path: `/projects/${x}/activity`, token: TOKENS.owner, body: { kind: "comment" } },
    { method: "POST", path: `/projects/${x}/activity`, token: TOKENS.owner, body: { kind: "view" } },
    { method: "DELETE", path: `/projects/${x}/members/4`, token: TOKENS.owner },
    { method: "PATCH", path: `/projects/${x}`, token: TOKENS.owner, body: { visibility: "private" } },
    { method: "PATCH", path: `/projects/${x}`, token: TOKENS.owner, body: { archived: true } },
    { method: "POST", path: "/projects", token: TOKENS.owner, body: { name: "Zz renamed fresh one" } },
    { method: "POST", path: "/projects", token: TOKENS.member, body: { name: "Member's own", visibility: "private" } },
  ];
  for (const w of writes) {
    const res = await p.same(w);
    assert.ok(res.status < 300, `${w.method} ${w.path} -> ${res.status} ${JSON.stringify(res.body)}`);
    await reads(p, x);
  }
});

test("a change another service makes to the database shows up in the very next listing", async () => {
  const p = new Pair(team150);
  const other = createAgentApp(p.agentDb, { now: NOW }); // a second instance over the same database
  const first = await p.same(list(TOKENS.owner, { perPage: "10" }));
  const x: number = first.body.items[0].id;
  const detail = await p.same({ path: `/projects/${x}`, token: TOKENS.owner });
  const someMember: number = detail.body.project.members[0].id;
  await reads(p, x);
  const checkOther = async () => {
    const [a, o] = await Promise.all([call(other, list(TOKENS.owner, { perPage: "10" })), call(p.oracle, list(TOKENS.owner, { perPage: "10" }))]);
    assert.deepStrictEqual(a, o, "a second instance served something else");
  };
  const writes: Array<[string, (db: FakeDb) => Promise<unknown>]> = [
    ["a member's account is deactivated", (db) => db.update("users", { id: someMember }, { deactivated_at: "2026-02-01T00:00:00Z" })],
    ["a newer activity row arrives", (db) => db.insert("activity", { project_id: x, actor_id: 2, kind: "comment", at: "2030-01-01T00:00:00Z" })],
    ["a newer page view arrives", (db) => db.insert("activity", { project_id: x, actor_id: 2, kind: "view", at: "2031-01-01T00:00:00Z" })],
    ["the project is renamed", (db) => db.update("projects", { id: x }, { name: "Zz renamed elsewhere", updated_at: "2030-02-02T00:00:00Z" })],
    ["a tag is linked and another retired", async (db) => { await db.insert("project_tags", { project_id: x, tag_id: 4 }); await db.update("tags", { id: 1 }, { archived: true }); }],
    ["a tag is recoloured", (db) => db.update("tags", { id: 4 }, { color: "purple", label: "brand new tag" })],
    ["every member is removed", (db) => db.delete("project_members", { project_id: x })],
    ["private projects become org-wide", (db) => db.update("projects", { visibility: "private" }, { visibility: "org" })],
    ["the project is archived", (db) => db.update("projects", { id: x }, { archived: true })],
    ["an actor's account is deleted", (db) => db.delete("users", { id: 2 })],
    ["a project appears", (db) => db.insert("projects", { org_id: 1, key: "NEW", name: "Zz renamed inserted", description: "", visibility: "org", pinned: true, archived: false, created_at: "2030-03-03T00:00:00Z", updated_at: "2030-03-03T00:00:00Z" })],
  ];
  for (const [what, write] of writes) {
    await p.both(write);
    try {
      await reads(p, x);
      await checkOther();
    } catch (err) {
      (err as Error).message = `after: ${what}: ${(err as Error).message}`;
      throw err;
    }
  }
});

test("nothing leaks from one database to another", async () => {
  const a = makeTeam({ projects: 40, seed: 21 });
  const b = makeTeam({ projects: 40, seed: 22 }); // the same ids, different rows
  const appA = createAgentApp(cloneDb(a), { now: NOW });
  for (const token of [TOKENS.owner, TOKENS.member, TOKENS.guest]) {
    await call(appA, list(token, { perPage: "100", includeArchived: "true" }));
    for (let id = 1; id <= 40; id++) await call(appA, { path: `/projects/${id}`, token });
  }
  const p = new Pair(b);
  for (const token of [TOKENS.owner, TOKENS.member, TOKENS.guest]) {
    await p.same(list(token, { perPage: "100", includeArchived: "true" }));
    await p.same(list(token, { perPage: "10", page: "2", sort: "created", order: "desc" }));
    for (let id = 1; id <= 40; id++) await p.same({ path: `/projects/${id}`, token });
  }
});
