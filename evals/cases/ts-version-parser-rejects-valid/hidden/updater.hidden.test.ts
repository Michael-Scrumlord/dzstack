import { test } from "node:test";
import assert from "node:assert/strict";
import { findUpdate, pickNewest } from "../src/updater.ts";

test("the release candidate from the report is picked when pre-releases are on", () => {
  const tags = ["v2.0.0", "v2.1.0-rc.1+build.7", "v1.9.0"];
  const picked = pickNewest(tags, { includePrerelease: true });
  assert.equal(picked.newest, "v2.1.0-rc.1+build.7");
  assert.deepEqual(picked.skipped, []);
});

test("it is valid but ignored when pre-releases are off, and not reported as skipped", () => {
  const tags = ["v2.0.0", "v2.1.0-rc.1+build.7", "v1.9.0"];
  const picked = pickNewest(tags);
  assert.equal(picked.newest, "v2.0.0");
  assert.deepEqual(picked.skipped, []);
});

test("release candidates are ordered by the spec", () => {
  const tags = ["v2.1.0-rc.2", "v2.1.0-rc.10", "v2.1.0-rc.1+build.7", "v2.1.0-beta.11"];
  assert.equal(pickNewest(tags, { includePrerelease: true }).newest, "v2.1.0-rc.10");
});

test("the final release beats its release candidates", () => {
  assert.equal(pickNewest(["v2.1.0-rc.1+build.7", "v2.1.0", "v2.1.0-rc.9"], { includePrerelease: true }).newest, "v2.1.0");
});

test("only invalid tags are skipped", () => {
  const picked = pickNewest(["latest", "v2.01.0", "v1.2", "v1.0.0-alpha..1", "vv1.0.0", "v1.0.0", "v1.1.0-x-y-z.--"]);
  assert.equal(picked.newest, "v1.0.0");
  assert.deepEqual(picked.skipped, ["latest", "v2.01.0", "v1.2", "v1.0.0-alpha..1", "vv1.0.0"]);
});

test("tags without a v prefix work too", () => {
  assert.equal(pickNewest(["1.0.0", "1.2.0-rc.1+build.5"], { includePrerelease: true }).newest, "1.2.0-rc.1+build.5");
});

test("equal precedence: the tag listed first wins", () => {
  assert.equal(pickNewest(["v1.0.0+b", "v1.0.0+a"]).newest, "v1.0.0+b");
  assert.equal(pickNewest(["v1.0.0-rc.1+x", "v1.0.0-rc.1+y"], { includePrerelease: true }).newest, "v1.0.0-rc.1+x");
});

test("findUpdate offers the release candidate only when pre-releases are on", () => {
  const tags = ["v2.0.0", "v2.1.0-rc.1+build.7"];
  assert.equal(findUpdate("2.0.0", tags, { includePrerelease: true }), "v2.1.0-rc.1+build.7");
  assert.equal(findUpdate("2.0.0", tags), null);
});

test("findUpdate ignores build metadata when deciding what is newer", () => {
  assert.equal(findUpdate("2.1.0-rc.1", ["v2.1.0-rc.1+build.7"], { includePrerelease: true }), null);
  assert.equal(findUpdate("2.1.0-rc.1+build.2", ["v2.1.0-rc.2"], { includePrerelease: true }), "v2.1.0-rc.2");
  assert.equal(findUpdate("2.1.0-rc.1+build.7", ["v2.1.0"]), "v2.1.0");
});
