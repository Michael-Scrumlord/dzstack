import { test } from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../src/app.ts";
import type { App } from "../src/app.ts";
import { PersistenceError } from "../src/errors.ts";
import type { ApiResponse } from "../src/handlers.ts";
import type { Persistence } from "../src/persistence.ts";
import type { AuditEntry, DocumentRecord } from "../src/types.ts";

// ---------- a persistence fake whose calls finish only when the test says so ----------

interface PendingOp {
  kind: "load" | "save" | "list";
  id: string;
  seq: number;
  run(): void;
}

class GatedPersistence implements Persistence {
  stored = new Map<string, DocumentRecord>();
  pending: PendingOp[] = [];
  /** While true, every call waits in `pending`; otherwise it finishes on the next microtask. */
  gated = false;
  failSave: ((record: DocumentRecord) => boolean) | undefined;
  private counter = 0;

  private enqueue<T>(kind: PendingOp["kind"], id: string, effect: () => T): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const op: PendingOp = {
        kind,
        id,
        seq: ++this.counter,
        run: () => {
          try {
            resolve(effect());
          } catch (error) {
            reject(error);
          }
        },
      };
      if (this.gated) this.pending.push(op);
      else queueMicrotask(op.run);
    });
  }

  // A load answers with what was stored when it was asked, however late the answer arrives.
  load(id: string) {
    const snapshot = structuredClone(this.stored.get(id));
    return this.enqueue("load", id, () => snapshot);
  }

  // A save reaches storage at the moment it finishes.
  save(record: DocumentRecord) {
    const copy = structuredClone(record);
    return this.enqueue("save", record.id, () => {
      if (this.failSave?.(copy)) throw new PersistenceError("disk full");
      this.stored.set(copy.id, copy);
    });
  }

  list() {
    const ids = [...this.stored.keys()];
    return this.enqueue("list", "*", () => ids);
  }
}

// ---------- driving interleavings ----------

type Pick = (ops: PendingOp[]) => number;

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const POLICIES: Array<[string, () => Pick]> = [
  ["oldest call first", () => () => 0],
  ["newest call first", () => (ops) => ops.length - 1],
  ...Array.from({ length: 30 }, (_, i): [string, () => Pick] => [
    `random order ${i + 1}`,
    () => {
      const next = mulberry32(i + 1);
      return (ops) => Math.floor(next() * ops.length);
    },
  ]),
];

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
async function settle() {
  for (let i = 0; i < 4; i++) await new Promise<void>((resolve) => setImmediate(resolve));
}

/**
 * Lets the code run until it waits, then finishes one waiting persistence call chosen by `pick`,
 * and repeats until every promise has settled. `only` restricts which calls may finish.
 */
async function drive(
  fake: GatedPersistence,
  promises: Array<Promise<unknown>>,
  pick: Pick,
  label: string,
  only: (op: PendingOp) => boolean = () => true,
) {
  let remaining = promises.length;
  for (const promise of promises) promise.then(() => remaining--, () => remaining--);
  for (let step = 0; step < 4000; step++) {
    await settle();
    if (remaining === 0) return;
    const candidates = fake.pending.filter(only);
    if (candidates.length === 0) {
      await sleep(1);
      continue;
    }
    const op = candidates[pick(candidates)] as PendingOp;
    fake.pending.splice(fake.pending.indexOf(op), 1);
    op.run();
  }
  const waiting = fake.pending.map((op) => `${op.kind}(${op.id})`).join(", ");
  assert.fail(`${label}: requests never finished (persistence calls still waiting: ${waiting || "none"})`);
}

// ---------- the app under test ----------

const ALICE = "alice";
const BOB = "bob";
const CAROL = "carol";

function newWorld() {
  const fake = new GatedPersistence();
  let clock = 5_000;
  let counter = 0;
  const deps = { persistence: fake, now: () => ++clock, newId: () => `doc${++counter}` };
  return { fake, deps, app: createApp(deps) };
}

const request = (user: string, method: string, path: string, body?: unknown, query?: Record<string, string>) => ({
  method,
  path,
  body,
  query,
  user: { id: user },
});

const patch = (app: App, user: string, id: string, baseVersion: number, fields: Record<string, unknown>) =>
  app.handle(request(user, "PATCH", `/documents/${id}`, { baseVersion, fields }));

const docOf = (response: ApiResponse) => (response.body as { document: any }).document;

async function readDoc(app: App, id: string, user = ALICE) {
  const response = await app.handle(request(user, "GET", `/documents/${id}`));
  assert.equal(response.status, 200);
  return docOf(response);
}

async function searchIds(app: App, q: string): Promise<string[]> {
  const response = await app.handle(request(ALICE, "GET", "/search", undefined, { q }));
  return (response.body as { results: Array<{ id: string }> }).results.map((r) => r.id);
}

/** A document owned by alice that bob and carol may edit. Version 3 (created, two shares). */
async function seed(app: App, title = "Launch plan", body = "Rollout notes"): Promise<string> {
  const created = await app.handle(request(ALICE, "POST", "/documents", { title, body, tags: ["a"] }));
  assert.equal(created.status, 201);
  const id = docOf(created).id as string;
  for (const user of [BOB, CAROL]) {
    const shared = await app.handle(request(ALICE, "POST", `/documents/${id}/share`, { userId: user, role: "editor" }));
    assert.equal(shared.status, 200);
  }
  return id;
}
const BASE = 3;

function auditOf(app: App, id: string): AuditEntry[] {
  return app.audit.entries({ documentId: id });
}

/** What must hold whenever the dust has settled, whatever order things happened in. */
async function assertSettled(world: ReturnType<typeof newWorld>, app: App, id: string, label: string, firstVersion = 1) {
  const { fake, deps } = world;
  fake.gated = false;
  assert.equal(fake.pending.length, 0, `${label}: persistence calls left waiting`);
  const served = await readDoc(app, id);

  // persistence holds what the service serves
  const stored = fake.stored.get(id);
  assert.ok(stored, `${label}: nothing persisted`);
  assert.equal(stored.version, served.version, `${label}: persistence is at another version than the service`);
  for (const field of ["title", "body", "status", "tags"] as const) {
    assert.deepEqual(stored[field], served[field], `${label}: persisted ${field} differs from the served one`);
  }
  const restarted = createApp(deps);
  const afterRestart = await readDoc(restarted, id);
  assert.deepEqual(
    [afterRestart.version, afterRestart.title, afterRestart.body, afterRestart.status, afterRestart.tags],
    [served.version, served.title, served.body, served.status, served.tags],
    `${label}: a restart shows a different document`,
  );

  // every version has exactly one audit entry, in order
  const entries = auditOf(app, id);
  assert.deepEqual(
    entries.map((e) => e.version),
    Array.from({ length: served.version - firstVersion + 1 }, (_, i) => firstVersion + i),
    `${label}: the audit log does not hold each version exactly once`,
  );
  const seqs = app.audit.entries().map((e) => e.seq);
  assert.deepEqual(seqs, seqs.map((_, i) => i + 1), `${label}: seq is not 1, 2, 3 ...`);
  return { served, entries };
}

const editsAfter = (entries: AuditEntry[], version: number) => entries.filter((e) => e.version > version);
const byField = (entries: AuditEntry[]) => entries.map((e) => JSON.stringify(e.fields)).sort();

// ---------- concurrent saves ----------

test("[concurrent] two saves of different fields at the same time both survive, in every order", async () => {
  for (const [label, makePick] of POLICIES) {
    const world = newWorld();
    const id = await seed(world.app);
    world.fake.gated = true;
    const bob = patch(world.app, BOB, id, BASE, { title: "Launch plan v2" });
    const carol = patch(world.app, CAROL, id, BASE, { body: "Rollout notes v2" });
    await drive(world.fake, [bob, carol], makePick(), label);
    const [rb, rc] = [await bob, await carol];
    assert.deepEqual([rb.status, rc.status], [200, 200], `${label}: both saves are accepted`);
    const { served, entries } = await assertSettled(world, world.app, id, label);
    assert.deepEqual([served.title, served.body, served.version], ["Launch plan v2", "Rollout notes v2", BASE + 2], label);
    const answers = [docOf(rb), docOf(rc)].sort((a, b) => a.version - b.version);
    assert.deepEqual(answers.map((d) => d.version), [BASE + 1, BASE + 2], `${label}: the two answers carry the next two versions`);
    assert.deepEqual([answers[1].title, answers[1].body], ["Launch plan v2", "Rollout notes v2"], `${label}: the later answer shows both edits`);
    assert.deepEqual(byField(editsAfter(entries, BASE)), ['{"body":"Rollout notes v2"}', '{"title":"Launch plan v2"}'], label);
    assert.deepEqual(await searchIds(world.app, "launch rollout"), [id], `${label}: search sees both edits`);
  }
});

test("[concurrent] four people saving four different fields at once lose nothing", async () => {
  for (const [label, makePick] of POLICIES) {
    const world = newWorld();
    const id = await seed(world.app);
    world.fake.gated = true;
    const saves = [
      patch(world.app, ALICE, id, BASE, { title: "T" }),
      patch(world.app, BOB, id, BASE, { body: "B" }),
      patch(world.app, CAROL, id, BASE, { status: "review" }),
      patch(world.app, ALICE, id, BASE, { tags: ["a", "z"] }),
    ];
    await drive(world.fake, saves, makePick(), label);
    const answers = await Promise.all(saves);
    assert.deepEqual(answers.map((r) => r.status), [200, 200, 200, 200], label);
    const { served, entries } = await assertSettled(world, world.app, id, label);
    assert.deepEqual([served.title, served.body, served.status, served.tags, served.version], ["T", "B", "review", ["a", "z"], BASE + 4], label);
    assert.deepEqual(
      byField(editsAfter(entries, BASE)),
      ['{"body":"B"}', '{"status":"review"}', '{"tags":["a","z"]}', '{"title":"T"}'],
      `${label}: one entry per change`,
    );
  }
});

test("[concurrent] two saves of the same field: one wins, the other gets a 409 and can retry", async () => {
  for (const [label, makePick] of POLICIES) {
    const world = newWorld();
    const id = await seed(world.app);
    world.fake.gated = true;
    const bob = patch(world.app, BOB, id, BASE, { title: "Bob's title" });
    const carol = patch(world.app, CAROL, id, BASE, { title: "Carol's title" });
    await drive(world.fake, [bob, carol], makePick(), label);
    const results = [
      { user: BOB, value: "Bob's title", response: await bob },
      { user: CAROL, value: "Carol's title", response: await carol },
    ];
    const winners = results.filter((r) => r.response.status === 200);
    const losers = results.filter((r) => r.response.status === 409);
    assert.equal(winners.length, 1, `${label}: exactly one save is accepted`);
    assert.equal(losers.length, 1, `${label}: exactly one save is refused with 409`);
    const [winner, loser] = [winners[0]!, losers[0]!];
    const conflict = loser.response.body as any;
    assert.equal(conflict.error, "conflict", label);
    assert.equal(typeof conflict.message, "string", label);
    assert.equal(conflict.currentVersion, BASE + 1, `${label}: the 409 names the stored version`);
    assert.deepEqual(conflict.conflictingFields, ["title"], label);
    assert.equal(conflict.document.title, winner.value, `${label}: the 409 shows the current document`);
    assert.equal(conflict.document.version, BASE + 1, label);

    let { served, entries } = await assertSettled(world, world.app, id, label);
    assert.deepEqual([served.title, served.version], [winner.value, BASE + 1], `${label}: the winner's edit is what is stored`);
    assert.equal(editsAfter(entries, BASE).length, 1, `${label}: the refused save left no entry`);

    const retry = await patch(world.app, loser.user, id, conflict.currentVersion, { title: loser.value });
    assert.equal(retry.status, 200, `${label}: the retry is accepted`);
    assert.equal(docOf(retry).version, BASE + 2, label);
    ({ served, entries } = await assertSettled(world, world.app, id, `${label}, after the retry`));
    assert.deepEqual([served.title, served.version], [loser.value, BASE + 2], label);
    assert.equal(editsAfter(entries, BASE).length, 2, label);
  }
});

test("[concurrent] three saves at once: the two on one field conflict, the third merges", async () => {
  for (const [label, makePick] of POLICIES) {
    const world = newWorld();
    const id = await seed(world.app);
    world.fake.gated = true;
    const bob = patch(world.app, BOB, id, BASE, { title: "X" });
    const carol = patch(world.app, CAROL, id, BASE, { title: "Y" });
    const alice = patch(world.app, ALICE, id, BASE, { body: "Z" });
    await drive(world.fake, [bob, carol, alice], makePick(), label);
    const [rb, rc, ra] = [await bob, await carol, await alice];
    assert.equal(ra.status, 200, `${label}: the save on another field is accepted`);
    assert.deepEqual([rb.status, rc.status].sort(), [200, 409], label);
    const { served } = await assertSettled(world, world.app, id, label);
    assert.deepEqual([served.body, served.version], ["Z", BASE + 2], label);
    assert.ok(["X", "Y"].includes(served.title), label);
  }
});

test("[concurrent] two people making the same change at once make it once", async () => {
  for (const [label, makePick] of POLICIES) {
    const world = newWorld();
    const id = await seed(world.app);
    world.fake.gated = true;
    const bob = patch(world.app, BOB, id, BASE, { tags: ["x", "y"] });
    const carol = patch(world.app, CAROL, id, BASE, { tags: ["x", "y"] });
    await drive(world.fake, [bob, carol], makePick(), label);
    const [rb, rc] = [await bob, await carol];
    assert.deepEqual([rb.status, rc.status], [200, 200], `${label}: neither is a conflict`);
    const { served, entries } = await assertSettled(world, world.app, id, label);
    assert.deepEqual([served.tags, served.version], [["x", "y"], BASE + 1], `${label}: one new version`);
    assert.equal(editsAfter(entries, BASE).length, 1, `${label}: one audit entry`);
    assert.deepEqual([docOf(rb).tags, docOf(rc).tags], [["x", "y"], ["x", "y"]], label);
  }
});

test("[concurrent] sharing and editing at the same time lose neither", async () => {
  for (const [label, makePick] of POLICIES) {
    const world = newWorld();
    const id = await seed(world.app);
    world.fake.gated = true;
    const edit = patch(world.app, BOB, id, BASE, { title: "Edited while sharing" });
    const shareDave = world.app.handle(request(ALICE, "POST", `/documents/${id}/share`, { userId: "dave", role: "viewer" }));
    const shareErin = world.app.handle(request(ALICE, "POST", `/documents/${id}/share`, { userId: "erin", role: "editor" }));
    await drive(world.fake, [edit, shareDave, shareErin], makePick(), label);
    assert.deepEqual((await Promise.all([edit, shareDave, shareErin])).map((r) => r.status), [200, 200, 200], label);
    const { served, entries } = await assertSettled(world, world.app, id, label);
    assert.deepEqual([served.title, served.version], ["Edited while sharing", BASE + 3], label);
    const get = (user: string) => world.app.handle(request(user, "GET", `/documents/${id}`)).then((r) => r.status);
    assert.equal(await get("dave"), 200, `${label}: dave lost his access`);
    assert.equal(await get("erin"), 200, `${label}: erin lost her access`);
    const editAsErin = await patch(world.app, "erin", id, served.version, { body: "erin can edit" });
    assert.equal(editAsErin.status, 200, `${label}: erin is no longer an editor`);
    assert.deepEqual(editsAfter(entries, BASE).map((e) => e.action).sort(), ["edit", "share", "share"], label);
  }
});

// ---------- documents that are not in memory yet ----------

test("[concurrent] saves and reads that meet a document cold, at the same time, work on one copy", async () => {
  for (const [label, makePick] of POLICIES) {
    const world = newWorld();
    const id = await seed(world.app);
    const cold = createApp(world.deps); // a restarted process: nothing in memory
    world.fake.gated = true;
    const reader = cold.handle(request(ALICE, "GET", `/documents/${id}`));
    const bob = patch(cold, BOB, id, BASE, { title: "Cold title" });
    const carol = patch(cold, CAROL, id, BASE, { body: "Cold body" });
    const lateReader = cold.handle(request(ALICE, "GET", `/documents/${id}`));
    await drive(world.fake, [reader, bob, carol, lateReader], makePick(), label);
    assert.deepEqual([(await bob).status, (await carol).status], [200, 200], label);
    for (const read of [await reader, await lateReader]) {
      assert.equal(read.status, 200, label);
      assert.ok([BASE, BASE + 1, BASE + 2].includes(docOf(read).version), `${label}: a read showed version ${docOf(read).version}`);
    }
    const { served } = await assertSettled(world, cold, id, label, BASE + 1);
    assert.deepEqual([served.title, served.body, served.version], ["Cold title", "Cold body", BASE + 2], label);
    const third = await patch(cold, ALICE, id, BASE + 2, { status: "review" });
    assert.equal(third.status, 200, `${label}: a later save is refused or loses something`);
    const { served: after } = await assertSettled(world, cold, id, `${label}, third save`, BASE + 1);
    assert.deepEqual([after.title, after.body, after.status, after.version], ["Cold title", "Cold body", "review", BASE + 3], label);
  }
});

// ---------- persistence that fails ----------

test("[failure] a save that fails leaves no trace, and the same save can be tried again", async () => {
  const world = newWorld();
  const id = await seed(world.app);
  world.fake.failSave = (record) => record.title === "Phantom title";
  const failed = await patch(world.app, BOB, id, BASE, { title: "Phantom title" });
  assert.equal(failed.status, 503);
  assert.equal((failed.body as any).error, "storage_unavailable");
  const { served, entries } = await assertSettled(world, world.app, id, "after a failed save");
  assert.deepEqual([served.title, served.version, entries.length], ["Launch plan", BASE, BASE]);
  assert.deepEqual(await searchIds(world.app, "phantom"), []);
  assert.deepEqual(await searchIds(world.app, "launch"), [id]);

  world.fake.failSave = undefined;
  const retried = await patch(world.app, BOB, id, BASE, { title: "Phantom title" });
  assert.equal(retried.status, 200);
  assert.equal(docOf(retried).version, BASE + 1);
  const after = await assertSettled(world, world.app, id, "after the retry");
  assert.equal(after.entries.length, BASE + 1);
});

test("[failure] a save that fails does not drag a save at the same time down, and reads never see it", async () => {
  for (const [label, makePick] of POLICIES) {
    const world = newWorld();
    const id = await seed(world.app);
    world.fake.failSave = (record) => record.title === "Phantom title";
    world.fake.gated = true;
    const failing = patch(world.app, BOB, id, BASE, { title: "Phantom title" });
    await settle();
    const reader = world.app.handle(request(ALICE, "GET", `/documents/${id}`));
    const good = patch(world.app, CAROL, id, BASE, { body: "A good body" });
    await drive(world.fake, [failing, reader, good], makePick(), label);
    assert.equal((await failing).status, 503, label);
    assert.equal((await good).status, 200, `${label}: the other save is accepted`);
    const read = docOf(await reader);
    assert.notEqual(read.title, "Phantom title", `${label}: a read showed a save that failed`);
    const { served, entries } = await assertSettled(world, world.app, id, label);
    assert.deepEqual([served.title, served.body, served.version], ["Launch plan", "A good body", BASE + 1], label);
    assert.deepEqual(byField(editsAfter(entries, BASE)), ['{"body":"A good body"}'], label);
    assert.deepEqual(await searchIds(world.app, "phantom"), [], label);
  }
});

// ---------- documents are independent ----------

test("[independent] a slow save on one document does not hold up another", async () => {
  for (const [label, makePick] of POLICIES.slice(0, 6)) {
    const world = newWorld();
    const first = await seed(world.app, "First doc", "one");
    const second = await seed(world.app, "Second doc", "two");
    world.fake.gated = true;
    let firstDone = false;
    const slow = patch(world.app, BOB, first, BASE, { title: "First, edited" }).then((r) => ((firstDone = true), r));
    await settle();
    const quick = patch(world.app, BOB, second, BASE, { title: "Second, edited" });
    await drive(world.fake, [quick], makePick(), `${label}: the edit of the second document waited for the first`, (op) => op.id === second);
    assert.equal(firstDone, false, `${label}: the first save should still be waiting`);
    assert.equal((await quick).status, 200, label);
    await drive(world.fake, [slow], makePick(), label);
    assert.equal((await slow).status, 200, label);
    await assertSettled(world, world.app, first, `${label}, first`);
    await assertSettled(world, world.app, second, `${label}, second`);
  }
});

// ---------- the rules, one request after another ----------

async function quiet() {
  const world = newWorld();
  const id = await seed(world.app);
  return { ...world, id };
}

test("[rules] an old base version merges whatever other fields have changed since", async () => {
  const { app, id } = await quiet();
  assert.equal((await patch(app, ALICE, id, BASE, { title: "T1" })).status, 200); // v4
  assert.equal((await patch(app, ALICE, id, BASE + 1, { body: "B1" })).status, 200); // v5
  assert.equal((await patch(app, ALICE, id, BASE + 2, { status: "review" })).status, 200); // v6
  const late = await patch(app, BOB, id, BASE, { tags: ["late"] });
  assert.equal(late.status, 200);
  assert.deepEqual(
    [docOf(late).title, docOf(late).body, docOf(late).status, docOf(late).tags, docOf(late).version],
    ["T1", "B1", "review", ["late"], BASE + 4],
  );
  const entries = auditOf(app, id);
  assert.deepEqual(entries.at(-1)?.fields, { tags: ["late"] });
  assert.equal(entries.at(-1)?.version, BASE + 4);
  assert.equal(entries.at(-1)?.actor, BOB);
  assert.equal(entries.at(-1)?.action, "edit");
});

test("[rules] only changes made after the base version conflict", async () => {
  const { app, id } = await quiet();
  await patch(app, ALICE, id, BASE, { title: "T1" }); // v4: title
  await patch(app, ALICE, id, BASE + 1, { body: "B1" }); // v5: body
  await patch(app, ALICE, id, BASE + 2, { status: "review" }); // v6: status
  const sawTitle = await patch(app, CAROL, id, BASE + 1, { title: "Carol's title" });
  assert.equal(sawTitle.status, 200, "the title changed in version 4, which a save based on 4 has seen");
  const missedBody = await patch(app, CAROL, id, BASE + 1, { body: "Carol's body" });
  assert.equal(missedBody.status, 409);
  assert.deepEqual((missedBody.body as any).conflictingFields, ["body"]);
  const missedStatus = await patch(app, CAROL, id, BASE + 1, { status: "published" });
  assert.equal(missedStatus.status, 409);
  assert.deepEqual((missedStatus.body as any).conflictingFields, ["status"]);
  const sameValue = await patch(app, CAROL, id, BASE + 1, { status: "review" });
  assert.equal(sameValue.status, 200, "setting the value a field already has is not a conflict");
});

test("[rules] a refused save changes and logs nothing, and names every conflicting field", async () => {
  const { app, id, fake } = await quiet();
  await patch(app, BOB, id, BASE, { title: "T1", body: "B1", status: "review" }); // v4
  const entriesBefore = auditOf(app, id).length;
  const refused = await patch(app, CAROL, id, BASE, { tags: ["new"], status: "published", title: "T2", body: "B2" });
  assert.equal(refused.status, 409);
  const body = refused.body as any;
  assert.deepEqual(body.conflictingFields, ["title", "body", "status"]);
  assert.equal(body.currentVersion, BASE + 1);
  assert.deepEqual(
    [body.document.title, body.document.body, body.document.status, body.document.tags, body.document.version],
    ["T1", "B1", "review", ["a"], BASE + 1],
  );
  assert.equal(auditOf(app, id).length, entriesBefore);
  assert.equal(fake.stored.get(id)?.version, BASE + 1);
  assert.deepEqual(fake.stored.get(id)?.tags, ["a"], "the tags in the refused save were not applied");
});

test("[rules] a save that changes nothing is accepted without a new version or an entry", async () => {
  const { app, id, fake } = await quiet();
  const response = await patch(app, BOB, id, BASE, { title: "Launch plan", tags: ["a"] });
  assert.equal(response.status, 200);
  assert.equal(docOf(response).version, BASE);
  assert.equal(auditOf(app, id).length, BASE);
  assert.equal(fake.stored.get(id)?.version, BASE);

  await patch(app, ALICE, id, BASE, { title: "Changed" }); // v4
  const stale = await patch(app, BOB, id, BASE, { title: "Changed" }); // somebody already made this change
  assert.equal(stale.status, 200);
  assert.equal(docOf(stale).version, BASE + 1);
  assert.equal(auditOf(app, id).length, BASE + 1);
});

test("[rules] only the fields that changed are logged", async () => {
  const { app, id } = await quiet();
  await patch(app, BOB, id, BASE, { title: "Launch plan", body: "New notes", status: "draft" });
  const entry = auditOf(app, id).at(-1);
  assert.deepEqual(entry?.fields, { body: "New notes" });
  assert.equal(entry?.version, BASE + 1);
});

test("[rules] a base version that makes no sense is a 400", async () => {
  const { app, id } = await quiet();
  const send = (body: unknown) => app.handle(request(BOB, "PATCH", `/documents/${id}`, body));
  for (const baseVersion of [undefined, null, "3", 1.5, -1]) {
    const response = await send({ baseVersion, fields: { title: "x" } });
    assert.equal(response.status, 400, `baseVersion ${String(baseVersion)}`);
  }
  const future = await send({ baseVersion: BASE + 1, fields: { title: "x" } });
  assert.equal(future.status, 400);
  assert.equal((future.body as any).error, "invalid_base_version");
  assert.equal(auditOf(app, id).length, BASE);
});

test("[rules] a stale base version works across a share too", async () => {
  const { app, id } = await quiet();
  const shared = await app.handle(request(ALICE, "POST", `/documents/${id}/share`, { userId: "dave", role: "viewer" }));
  assert.equal(docOf(shared).version, BASE + 1);
  const edit = await patch(app, BOB, id, BASE, { title: "Edited after a share" });
  assert.equal(edit.status, 200);
  assert.equal(docOf(edit).version, BASE + 2);
  const entries = auditOf(app, id);
  assert.deepEqual(entries.slice(-2).map((e) => [e.action, e.version]), [["share", BASE + 1], ["edit", BASE + 2]]);
  assert.deepEqual(entries[BASE]?.share, { userId: "dave", role: "viewer" });
});

test("[rules] the audit log numbers its entries across documents and keeps who did what", async () => {
  const { app, id } = await quiet();
  const other = await seed(app, "Other", "doc");
  await patch(app, BOB, id, BASE, { title: "One" });
  await patch(app, CAROL, other, BASE, { title: "Two" });
  const all = app.audit.entries();
  assert.deepEqual(all.map((e) => e.seq), all.map((_, i) => i + 1));
  const lastTwo = all.slice(-2);
  assert.deepEqual(lastTwo.map((e) => [e.documentId, e.actor, e.version]), [[id, BOB, BASE + 1], [other, CAROL, BASE + 1]]);
});
