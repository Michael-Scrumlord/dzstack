import { test } from "node:test";
import assert from "node:assert/strict";
import { createProjectRepository } from "../src/repository.ts";

test("stores projects and finds them again", () => {
  const repo = createProjectRepository();
  repo.insert({ id: "a", name: "Alpha", createdAt: 1 });
  repo.insert({ id: "b", name: "Beta", createdAt: 2 });
  assert.equal(repo.findById("a")?.name, "Alpha");
  assert.equal(repo.findById("zzz"), undefined);
  assert.deepEqual(repo.findAll().map((p) => p.id), ["a", "b"]);
});

test("hands out copies", () => {
  const repo = createProjectRepository();
  repo.insert({ id: "a", name: "Alpha", createdAt: 1 });
  const found = repo.findById("a");
  assert.ok(found);
  found.name = "changed";
  assert.equal(repo.findById("a")?.name, "Alpha");
});

test("updates and removes", () => {
  const repo = createProjectRepository();
  repo.insert({ id: "a", name: "Alpha", createdAt: 1 });
  assert.equal(repo.update("a", { name: "Alpha 2" })?.name, "Alpha 2");
  assert.equal(repo.update("zzz", { name: "x" }), undefined);
  assert.equal(repo.remove("a"), true);
  assert.equal(repo.remove("a"), false);
  assert.equal(repo.findById("a"), undefined);
});
