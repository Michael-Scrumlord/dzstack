import { test } from "node:test";
import assert from "node:assert/strict";
import { ConflictError, NotFoundError, ValidationError } from "../src/errors.ts";
import { createProjectRepository } from "../src/repository.ts";
import { createProjectService } from "../src/service.ts";

function setup() {
  let time = 1000;
  let n = 0;
  const service = createProjectService(createProjectRepository(), { now: () => time, newId: () => `p${++n}` });
  return { service, setTime: (t: number) => void (time = t) };
}

test("creates a project with a trimmed name", () => {
  const { service } = setup();
  const p = service.create({ name: "  Apollo " });
  assert.equal(p.id, "p1");
  assert.equal(p.name, "Apollo");
  assert.equal(p.createdAt, 1000);
  assert.equal(service.get("p1").name, "Apollo");
});

test("rejects bad and duplicate names", () => {
  const { service } = setup();
  service.create({ name: "Apollo" });
  assert.throws(() => service.create({ name: "" }), ValidationError);
  assert.throws(() => service.create({ name: 5 }), ValidationError);
  assert.throws(() => service.create({ name: "x".repeat(61) }), ValidationError);
  assert.throws(() => service.create({ name: "APOLLO" }), ConflictError);
});

test("lists projects in creation order", () => {
  const { service } = setup();
  service.create({ name: "B" });
  service.create({ name: "A" });
  assert.deepEqual(service.list().map((p) => p.name), ["B", "A"]);
});

test("renames, keeping names unique", () => {
  const { service } = setup();
  const a = service.create({ name: "A" });
  service.create({ name: "B" });
  assert.equal(service.rename(a.id, "A2").name, "A2");
  assert.equal(service.rename(a.id, "a2").name, "a2");
  assert.throws(() => service.rename(a.id, "b"), ConflictError);
  assert.throws(() => service.rename("nope", "C"), NotFoundError);
});

test("a deleted project is gone, and its name is free again", () => {
  const { service } = setup();
  const a = service.create({ name: "A" });
  service.delete(a.id);
  assert.throws(() => service.get(a.id), NotFoundError);
  assert.throws(() => service.delete(a.id), NotFoundError);
  assert.deepEqual(service.list(), []);
  assert.equal(service.create({ name: "A" }).name, "A");
});
