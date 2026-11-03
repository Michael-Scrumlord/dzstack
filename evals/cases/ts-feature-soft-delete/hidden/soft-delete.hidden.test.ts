import { test } from "node:test";
import assert from "node:assert/strict";
import { ConflictError, NotFoundError, RestoreExpiredError } from "../src/errors.ts";
import { handleRequest, type ApiRequest, type ApiUser } from "../src/handlers.ts";
import { createProjectRepository } from "../src/repository.ts";
import { createProjectService } from "../src/service.ts";

const DAY = 24 * 60 * 60 * 1000;
const WINDOW = 30 * DAY;
const T0 = 1_700_000_000_000;

function setup() {
  let time = T0;
  let n = 0;
  const repo = createProjectRepository();
  const service = createProjectService(repo, { now: () => time, newId: () => `p${++n}` });
  const clock = {
    at: (t: number) => void (time = t),
    advance: (ms: number) => void (time += ms),
    get now() {
      return time;
    },
  };
  const call = (req: ApiRequest) => handleRequest(service, req);
  return { repo, service, clock, call };
}

const admin: ApiUser = { id: "u1", role: "admin" };
const member: ApiUser = { id: "u2", role: "member" };
const names = (projects: { name: string }[]) => projects.map((p) => p.name);

// ---------- repository ----------

function seededRepo() {
  const repo = createProjectRepository();
  repo.insert({ id: "a", name: "Alpha", createdAt: 1, deletedAt: null });
  repo.insert({ id: "b", name: "Beta", createdAt: 2, deletedAt: null });
  repo.insert({ id: "c", name: "Gamma", createdAt: 3, deletedAt: null });
  return repo;
}

test("repository: deleted projects are skipped unless asked for", () => {
  const repo = seededRepo();
  repo.update("b", { deletedAt: 500 });
  assert.deepEqual(repo.findAll().map((p) => p.id), ["a", "c"]);
  assert.deepEqual(repo.findAll({}).map((p) => p.id), ["a", "c"]);
  assert.deepEqual(repo.findAll({ includeDeleted: false }).map((p) => p.id), ["a", "c"]);
  assert.deepEqual(repo.findAll({ includeDeleted: true }).map((p) => p.id), ["a", "b", "c"]);
  assert.equal(repo.findById("b"), undefined);
  assert.equal(repo.findById("b", {}), undefined);
  assert.equal(repo.findById("b", { includeDeleted: false }), undefined);
  assert.equal(repo.findById("b", { includeDeleted: true })?.deletedAt, 500);
  assert.equal(repo.findById("a")?.deletedAt, null);
  assert.equal(repo.findById("a", { includeDeleted: true })?.name, "Alpha");
});

test("repository: update and remove also work on deleted projects", () => {
  const repo = seededRepo();
  repo.update("b", { deletedAt: 500 });
  const renamed = repo.update("b", { name: "Beta 2" });
  assert.equal(renamed?.name, "Beta 2");
  assert.equal(renamed?.deletedAt, 500);
  const restored = repo.update("b", { deletedAt: null });
  assert.equal(restored?.deletedAt, null);
  assert.equal(repo.findById("b")?.name, "Beta 2");
  repo.update("c", { deletedAt: 600 });
  assert.equal(repo.remove("c"), true);
  assert.equal(repo.findById("c", { includeDeleted: true }), undefined);
  assert.equal(repo.remove("c"), false);
  assert.equal(repo.update("zzz", { deletedAt: 1 }), undefined);
});

// ---------- service: delete ----------

test("service: new projects are live", () => {
  const { service } = setup();
  const p = service.create({ name: "Alpha" });
  assert.equal(p.deletedAt, null);
  assert.equal(service.get(p.id).deletedAt, null);
});

test("service: delete hides the project from get, rename and list", () => {
  const { service, clock } = setup();
  const a = service.create({ name: "Alpha" });
  service.create({ name: "Beta" });
  clock.advance(5000);
  assert.equal(service.delete(a.id), undefined);
  assert.throws(() => service.get(a.id), NotFoundError);
  assert.throws(() => service.rename(a.id, "Alpha 2"), NotFoundError);
  assert.deepEqual(names(service.list()), ["Beta"]);
  assert.deepEqual(names(service.list({ includeDeleted: false })), ["Beta"]);
});

test("service: delete of an unknown or already deleted project is NotFound and changes nothing", () => {
  const { service, clock } = setup();
  const a = service.create({ name: "Alpha" });
  assert.throws(() => service.delete("nope"), NotFoundError);
  clock.advance(1000);
  service.delete(a.id);
  const deletedAt = T0 + 1000;
  clock.advance(DAY);
  assert.throws(() => service.delete(a.id), NotFoundError);
  assert.equal(service.list({ includeDeleted: true })[0].deletedAt, deletedAt);
});

test("service: list with includeDeleted keeps creation order and shows deletedAt", () => {
  const { service, clock } = setup();
  const a = service.create({ name: "Alpha" });
  const b = service.create({ name: "Beta" });
  const c = service.create({ name: "Gamma" });
  clock.advance(7000);
  service.delete(b.id);
  const all = service.list({ includeDeleted: true });
  assert.deepEqual(names(all), ["Alpha", "Beta", "Gamma"]);
  assert.deepEqual(all.map((p) => p.deletedAt), [null, T0 + 7000, null]);
  assert.deepEqual(all.map((p) => p.id), [a.id, b.id, c.id]);
});

test("service: a deleted project no longer holds its name", () => {
  const { service } = setup();
  const a = service.create({ name: "Alpha" });
  const b = service.create({ name: "Beta" });
  service.delete(a.id);
  assert.equal(service.create({ name: "alpha" }).name, "alpha");
  service.delete(b.id);
  const c = service.create({ name: "Gamma" });
  assert.equal(service.rename(c.id, "BETA").name, "BETA");
});

// ---------- service: restore ----------

test("service: restore brings the project back where it was", () => {
  const { service, clock } = setup();
  service.create({ name: "Alpha" });
  const b = service.create({ name: "Beta" });
  service.create({ name: "Gamma" });
  service.delete(b.id);
  clock.advance(3 * DAY);
  const restored = service.restore(b.id);
  assert.equal(restored.id, b.id);
  assert.equal(restored.name, "Beta");
  assert.equal(restored.createdAt, T0);
  assert.equal(restored.deletedAt, null);
  assert.equal(service.get(b.id).deletedAt, null);
  assert.deepEqual(names(service.list()), ["Alpha", "Beta", "Gamma"]);
  assert.equal(service.rename(b.id, "Beta 2").name, "Beta 2");
});

test("service: the restore window is exactly 30 days", () => {
  const { service, clock } = setup();
  const a = service.create({ name: "Alpha" });
  const b = service.create({ name: "Beta" });
  service.delete(a.id);
  service.delete(b.id);
  clock.at(T0 + WINDOW);
  assert.equal(service.restore(a.id).deletedAt, null);
  clock.at(T0 + WINDOW + 1);
  assert.throws(() => service.restore(b.id), RestoreExpiredError);
  assert.deepEqual(service.list({ includeDeleted: true }).map((p) => p.deletedAt), [null, T0]);
});

test("service: restore of an unknown or a live project", () => {
  const { service } = setup();
  const a = service.create({ name: "Alpha" });
  assert.throws(() => service.restore("nope"), NotFoundError);
  assert.throws(() => service.restore(a.id), ConflictError);
  service.delete(a.id);
  service.restore(a.id);
  assert.throws(() => service.restore(a.id), ConflictError);
});

test("service: restore does not take a name a live project has now", () => {
  const { service, clock } = setup();
  const a = service.create({ name: "Alpha" });
  service.delete(a.id);
  clock.advance(DAY);
  const other = service.create({ name: "ALPHA" });
  assert.throws(() => service.restore(a.id), ConflictError);
  assert.deepEqual(service.list({ includeDeleted: true }).map((p) => p.deletedAt), [T0, null]);
  assert.throws(() => service.get(a.id), NotFoundError);
  service.rename(other.id, "Other");
  assert.equal(service.restore(a.id).name, "Alpha");
  assert.deepEqual(names(service.list()), ["Alpha", "Other"]);
});

test("service: a name conflict with another deleted project is not a conflict", () => {
  const { service } = setup();
  const a = service.create({ name: "Alpha" });
  service.delete(a.id);
  const again = service.create({ name: "Alpha" });
  service.delete(again.id);
  assert.equal(service.restore(a.id).name, "Alpha");
  assert.throws(() => service.restore(again.id), ConflictError);
});

test("service: an expired restore beats a name conflict", () => {
  const { service, clock } = setup();
  const a = service.create({ name: "Alpha" });
  service.delete(a.id);
  service.create({ name: "Alpha" });
  clock.at(T0 + WINDOW + 1);
  assert.throws(() => service.restore(a.id), RestoreExpiredError);
});

test("service: deleting again starts a new 30 days", () => {
  const { service, clock } = setup();
  const a = service.create({ name: "Alpha" });
  service.delete(a.id);
  clock.at(T0 + 10 * DAY);
  service.restore(a.id);
  clock.at(T0 + 20 * DAY);
  service.delete(a.id);
  assert.equal(service.list({ includeDeleted: true })[0].deletedAt, T0 + 20 * DAY);
  clock.at(T0 + 20 * DAY + WINDOW + 1);
  assert.throws(() => service.restore(a.id), RestoreExpiredError);
  clock.at(T0 + 20 * DAY + WINDOW);
  assert.equal(service.restore(a.id).deletedAt, null);
});

// ---------- handlers ----------

test("handlers: delete answers 204 and the project disappears", () => {
  const { call } = setup();
  call({ method: "POST", path: "/projects", body: { name: "Alpha" } });
  call({ method: "POST", path: "/projects", body: { name: "Beta" } });
  const deleted = call({ method: "DELETE", path: "/projects/p1" });
  assert.equal(deleted.status, 204);
  assert.equal(deleted.body, undefined);
  const get = call({ method: "GET", path: "/projects/p1" });
  assert.equal(get.status, 404);
  assert.equal((get.body as any).error, "not_found");
  assert.equal(call({ method: "PATCH", path: "/projects/p1", body: { name: "x" } }).status, 404);
  assert.deepEqual(names((call({ method: "GET", path: "/projects" }).body as any).projects), ["Beta"]);
  const again = call({ method: "DELETE", path: "/projects/p1" });
  assert.equal(again.status, 404);
  assert.equal((again.body as any).error, "not_found");
});

test("handlers: a deleted project's name can be used again", () => {
  const { call } = setup();
  call({ method: "POST", path: "/projects", body: { name: "Alpha" } });
  call({ method: "DELETE", path: "/projects/p1" });
  assert.equal(call({ method: "POST", path: "/projects", body: { name: "Alpha" } }).status, 201);
});

test("handlers: restore answers 200 with the project", () => {
  const { call } = setup();
  call({ method: "POST", path: "/projects", body: { name: "Alpha" } });
  call({ method: "DELETE", path: "/projects/p1" });
  const res = call({ method: "POST", path: "/projects/p1/restore" });
  assert.equal(res.status, 200);
  const project = (res.body as any).project;
  assert.equal(project.id, "p1");
  assert.equal(project.name, "Alpha");
  assert.equal(project.deletedAt, null);
  assert.equal(call({ method: "GET", path: "/projects/p1" }).status, 200);
  assert.deepEqual(names((call({ method: "GET", path: "/projects" }).body as any).projects), ["Alpha"]);
});

test("handlers: restore errors map to 404, 409 and 410", () => {
  const { call, clock } = setup();
  const unknown = call({ method: "POST", path: "/projects/nope/restore" });
  assert.equal(unknown.status, 404);
  assert.equal((unknown.body as any).error, "not_found");

  call({ method: "POST", path: "/projects", body: { name: "Alpha" } });
  const live = call({ method: "POST", path: "/projects/p1/restore" });
  assert.equal(live.status, 409);
  assert.equal((live.body as any).error, "conflict");

  call({ method: "DELETE", path: "/projects/p1" });
  call({ method: "POST", path: "/projects", body: { name: "alpha" } });
  const taken = call({ method: "POST", path: "/projects/p1/restore" });
  assert.equal(taken.status, 409);
  assert.equal((taken.body as any).error, "conflict");
  assert.equal(call({ method: "GET", path: "/projects/p1" }).status, 404);

  call({ method: "DELETE", path: "/projects/p2" });
  call({ method: "POST", path: "/projects", body: { name: "Beta" } });
  call({ method: "DELETE", path: "/projects/p3" });
  clock.at(T0 + WINDOW + 1);
  const late = call({ method: "POST", path: "/projects/p3/restore" });
  assert.equal(late.status, 410);
  assert.equal((late.body as any).error, "restore_expired");
  assert.equal(typeof (late.body as any).message, "string");
});

test("handlers: only an admin can list deleted projects", () => {
  const { call, clock } = setup();
  call({ method: "POST", path: "/projects", body: { name: "Alpha" } });
  call({ method: "POST", path: "/projects", body: { name: "Beta" } });
  call({ method: "POST", path: "/projects", body: { name: "Gamma" } });
  clock.advance(9000);
  call({ method: "DELETE", path: "/projects/p2" });
  const query = { includeDeleted: "true" };

  const adminList = call({ method: "GET", path: "/projects", query, user: admin });
  assert.equal(adminList.status, 200);
  const projects = (adminList.body as any).projects;
  assert.deepEqual(names(projects), ["Alpha", "Beta", "Gamma"]);
  assert.deepEqual(projects.map((p: any) => p.deletedAt), [null, T0 + 9000, null]);

  for (const user of [member, undefined]) {
    const res = call({ method: "GET", path: "/projects", query, user });
    assert.equal(res.status, 403);
    assert.equal((res.body as any).error, "forbidden");
    assert.equal(typeof (res.body as any).message, "string");
  }
});

test("handlers: without includeDeleted=true the list hides deleted projects for everybody", () => {
  const { call } = setup();
  call({ method: "POST", path: "/projects", body: { name: "Alpha" } });
  call({ method: "POST", path: "/projects", body: { name: "Beta" } });
  call({ method: "DELETE", path: "/projects/p1" });
  for (const user of [admin, member, undefined]) {
    for (const query of [undefined, {}, { includeDeleted: "false" }]) {
      const res = call({ method: "GET", path: "/projects", query, user });
      assert.equal(res.status, 200);
      assert.deepEqual(names((res.body as any).projects), ["Beta"]);
    }
  }
});

test("handlers: the existing routes keep working", () => {
  const { call } = setup();
  const created = call({ method: "POST", path: "/projects", body: { name: "Alpha" } });
  assert.equal(created.status, 201);
  assert.equal((created.body as any).project.deletedAt, null);
  assert.equal(call({ method: "POST", path: "/projects", body: { name: "ALPHA" } }).status, 409);
  assert.equal(call({ method: "POST", path: "/projects", body: { name: "" } }).status, 400);
  assert.equal(call({ method: "PATCH", path: "/projects/p1", body: { name: "Alpha 2" } }).status, 200);
  assert.equal(call({ method: "GET", path: "/nothing" }).status, 404);
});
