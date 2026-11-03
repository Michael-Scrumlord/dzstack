import { test } from "node:test";
import assert from "node:assert/strict";
import { FakeDb, MAX_IN_LIST, TooManyParametersError } from "../src/db/fake.ts";
import { smallTeam } from "../testkit/small.ts";

test("every call is one query and rows are counted", async () => {
  const db = smallTeam();
  assert.equal(db.stats.queries, 0);
  await db.select("projects", { where: { org_id: 1 } });
  await db.count("projects");
  assert.equal(db.stats.queries, 2);
  assert.equal(db.stats.rowsRead, 6 + 1);
  assert.equal(db.stats.simulatedMs, 2 * 4 + 7 * 0.02);
  db.resetStats();
  assert.equal(db.stats.queries, 0);
  assert.equal(db.log.length, 0);
});

test("equality, null, operators and $or", async () => {
  const db = smallTeam();
  const gone = await db.select("users", { where: { deactivated_at: { isNull: false } } });
  assert.deepEqual(gone.map((u) => u.name), ["Fay"]);
  const some = await db.select("projects", { where: { org_id: 1, $or: [{ pinned: true }, { visibility: "private" }] } });
  assert.deepEqual(some.map((p) => p.id), [1, 3, 5]);
  const range = await db.select("activity", { where: { at: { gte: "2026-02-01T00:00:00Z", lt: "2026-03-01T00:00:00Z" } } });
  assert.deepEqual(range.map((a) => a.id), [4, 5]);
});

test("ilike is case-insensitive and treats % and _ as wildcards unless escaped", async () => {
  const db = new FakeDb({
    projects: ["Alpha 100%", "alpha 1000", "a_b", "axb"].map((name, i) => ({
      id: i + 1, org_id: 1, key: `k${i}`, name, description: "", visibility: "org" as const, pinned: false, archived: false, created_at: "", updated_at: "",
    })),
  });
  const names = async (pattern: string) => (await db.select("projects", { where: { name: { ilike: pattern } } })).map((p) => p.name);
  assert.deepEqual(await names("ALPHA%"), ["Alpha 100%", "alpha 1000"]);
  assert.deepEqual(await names("%100\\%"), ["Alpha 100%"]);
  assert.deepEqual(await names("a_b"), ["a_b", "axb"]);
  assert.deepEqual(await names("a\\_b"), ["a_b"]);
});

test("orderBy: nocase, descending, ties keep going to the next key", async () => {
  const db = smallTeam();
  const rows = await db.select("projects", {
    where: { org_id: 1 },
    orderBy: [{ column: "name", nocase: true, dir: "desc" }, { column: "id" }],
  });
  assert.deepEqual(rows.map((p) => p.name), ["Zephyr", "website", "Payments", "Billing", "Archive 2024", "apollo"]);
  const plain = await db.select("projects", { where: { org_id: 1 }, orderBy: [{ column: "name" }] });
  assert.equal(plain[0].name, "Archive 2024"); // "A" sorts before "B", and every capital before every lowercase letter
  assert.equal(plain[plain.length - 1].name, "website");
  assert.equal(plain[plain.length - 2].name, "apollo");
});

test("distinctOn keeps the first row per value after ordering", async () => {
  const db = smallTeam();
  const latest = await db.select("activity", {
    orderBy: [{ column: "at", dir: "desc" }],
    distinctOn: "project_id",
  });
  assert.deepEqual(latest.map((a) => [a.project_id, a.id]), [[1, 3], [2, 4], [5, 5]]);
});

test("selectPage returns the page and the total in one query", async () => {
  const db = smallTeam();
  const page = await db.selectPage("projects", { where: { org_id: 1 }, orderBy: [{ column: "id" }], limit: 2, offset: 2 });
  assert.deepEqual(page.rows.map((p) => p.id), [3, 4]);
  assert.equal(page.total, 6);
  assert.equal(db.stats.queries, 1);
});

test("inSelect filters by a sub-query inside the same query", async () => {
  const db = smallTeam();
  const mine = await db.select("projects", {
    where: { id: { inSelect: { table: "project_members", column: "project_id", where: { user_id: 3 } } } },
  });
  assert.deepEqual(mine.map((p) => p.id), [1, 2, 3]);
  assert.equal(db.stats.queries, 1);
});

test("an in-list over the limit throws, as the production driver does", async () => {
  const db = smallTeam();
  const ids = Array.from({ length: MAX_IN_LIST + 1 }, (_, i) => i);
  await assert.rejects(db.select("users", { where: { id: { in: ids } } }), TooManyParametersError);
  await db.select("users", { where: { id: { in: ids.slice(0, MAX_IN_LIST) } } });
});

test("rows come back as copies", async () => {
  const db = smallTeam();
  const [user] = await db.select("users", { where: { id: 1 } });
  user.name = "changed";
  const [again] = await db.select("users", { where: { id: 1 } });
  assert.equal(again.name, "Ada");
});

test("insert assigns the next id; update and delete report how many rows they touched", async () => {
  const db = smallTeam();
  const tag = await db.insert("tags", { org_id: 1, label: "new", color: null, archived: false });
  assert.equal(tag.id, 6);
  assert.equal(await db.update("tags", { org_id: 1 }, { archived: true }), 5);
  assert.equal(await db.delete("tags", { archived: true }), 5);
});
