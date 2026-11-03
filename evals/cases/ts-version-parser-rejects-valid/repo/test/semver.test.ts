import { test } from "node:test";
import assert from "node:assert/strict";
import { InvalidVersionError, compareVersions, formatVersion, isValidVersion, parseVersion } from "../src/semver.ts";

test("parses a release", () => {
  assert.deepEqual(parseVersion("1.2.3"), { major: 1, minor: 2, patch: 3, prerelease: [], build: [] });
});

test("parses a pre-release and build metadata", () => {
  assert.deepEqual(parseVersion("1.2.3-beta+sha"), { major: 1, minor: 2, patch: 3, prerelease: ["beta"], build: ["sha"] });
});

test("formats what it parsed", () => {
  assert.equal(formatVersion(parseVersion("4.5.6-rc+exp")), "4.5.6-rc+exp");
});

test("rejects text that is not a version", () => {
  for (const text of ["", "1", "1.2", "1.2.3.4", "v1.2.3", " 1.2.3", "latest"]) {
    assert.equal(isValidVersion(text), false, text);
    assert.throws(() => parseVersion(text), InvalidVersionError);
  }
});

test("compares major, minor and patch numerically", () => {
  assert.equal(compareVersions("1.9.0", "1.10.0"), -1);
  assert.equal(compareVersions("2.0.0", "1.99.99"), 1);
  assert.equal(compareVersions("1.2.3", "1.2.3"), 0);
});

test("a release is newer than its pre-release", () => {
  assert.equal(compareVersions("1.0.0", "1.0.0-beta"), 1);
  assert.equal(compareVersions("1.0.0-beta", "1.0.0"), -1);
});

test("orders simple pre-releases", () => {
  assert.equal(compareVersions("1.0.0-alpha", "1.0.0-beta"), -1);
});

test("ignores build metadata", () => {
  assert.equal(compareVersions("1.0.0+a", "1.0.0+b"), 0);
});
