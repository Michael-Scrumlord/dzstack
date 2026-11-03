import { test } from "node:test";
import assert from "node:assert/strict";
import { handleRequest, type ApiRequest } from "../src/handlers.ts";
import { createProjectRepository } from "../src/repository.ts";
import { createProjectService } from "../src/service.ts";

function api() {
  let n = 0;
  const service = createProjectService(createProjectRepository(), { now: () => 5000, newId: () => `p${++n}` });
  return (req: ApiRequest) => handleRequest(service, req);
}

test("creates, reads, lists and renames", () => {
  const call = api();
  const created = call({ method: "POST", path: "/projects", body: { name: "Apollo" } });
  assert.equal(created.status, 201);
  assert.equal((created.body as any).project.id, "p1");
  assert.equal(call({ method: "GET", path: "/projects/p1" }).status, 200);
  assert.deepEqual((call({ method: "GET", path: "/projects" }).body as any).projects.map((p: any) => p.name), ["Apollo"]);
  const renamed = call({ method: "PATCH", path: "/projects/p1", body: { name: "Gemini" } });
  assert.equal((renamed.body as any).project.name, "Gemini");
});

test("maps errors to statuses", () => {
  const call = api();
  call({ method: "POST", path: "/projects", body: { name: "Apollo" } });
  assert.equal(call({ method: "POST", path: "/projects", body: { name: " " } }).status, 400);
  assert.equal(call({ method: "POST", path: "/projects", body: "nope" }).status, 400);
  assert.equal(call({ method: "POST", path: "/projects", body: { name: "apollo" } }).status, 409);
  assert.equal(call({ method: "GET", path: "/projects/zzz" }).status, 404);
  assert.equal(call({ method: "GET", path: "/nothing" }).status, 404);
  const missing = call({ method: "GET", path: "/projects/zzz" }).body as any;
  assert.equal(missing.error, "not_found");
  assert.equal(typeof missing.message, "string");
});

test("deleting answers 204 and the project is gone", () => {
  const call = api();
  call({ method: "POST", path: "/projects", body: { name: "Apollo" } });
  assert.deepEqual(call({ method: "DELETE", path: "/projects/p1" }), { status: 204 });
  assert.equal(call({ method: "GET", path: "/projects/p1" }).status, 404);
  assert.equal(call({ method: "DELETE", path: "/projects/p1" }).status, 404);
});
