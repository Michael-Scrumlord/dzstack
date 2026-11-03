import { test } from "node:test";
import assert from "node:assert/strict";
import { findUpdate, pickNewest } from "../src/updater.ts";

test("picks the highest version and keeps the tag as given", () => {
  assert.equal(pickNewest(["v1.2.0", "v1.10.0", "v1.9.0"]).newest, "v1.10.0");
});

test("skips tags that are not versions", () => {
  const picked = pickNewest(["latest", "v1.0.0", "v1.2"]);
  assert.equal(picked.newest, "v1.0.0");
  assert.deepEqual(picked.skipped, ["latest", "v1.2"]);
});

test("ignores pre-releases unless asked", () => {
  const tags = ["v1.0.0", "v2.0.0-beta"];
  assert.equal(pickNewest(tags).newest, "v1.0.0");
  assert.equal(pickNewest(tags, { includePrerelease: true }).newest, "v2.0.0-beta");
});

test("nothing qualifying gives null", () => {
  assert.equal(pickNewest([]).newest, null);
  assert.equal(pickNewest(["v1.0.0-rc"]).newest, null);
});

test("finds an update only when the newest tag is newer", () => {
  assert.equal(findUpdate("1.0.0", ["v1.0.0", "v1.1.0"]), "v1.1.0");
  assert.equal(findUpdate("1.1.0", ["v1.0.0", "v1.1.0"]), null);
});
