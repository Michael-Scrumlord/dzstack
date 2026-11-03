import { test } from "node:test";
import assert from "node:assert/strict";
import { formatVersion, isValidVersion, parseVersion, tryParseVersion } from "../src/semver.ts";

// Valid versions: the spec's own examples (items 9 and 10), the regex test list published on
// semver.org, and the version from the bug report.
const VALID = [
  "2.1.0-rc.1+build.7",
  "1.0.0-rc.1+build.5",
  "1.0.0-alpha",
  "1.0.0-alpha.1",
  "1.0.0-0.3.7",
  "1.0.0-x.7.z.92",
  "1.0.0-x-y-z.--",
  "1.0.0-alpha+001",
  "1.0.0+20130313144700",
  "1.0.0-beta+exp.sha.5114f85",
  "1.0.0+21AF26D3----117B344092BD",
  "0.0.4",
  "1.2.3",
  "10.20.30",
  "1.1.2-prerelease+meta",
  "1.1.2+meta",
  "1.1.2+meta-valid",
  "1.0.0-beta",
  "1.0.0-alpha.beta",
  "1.0.0-alpha.beta.1",
  "1.0.0-alpha0.valid",
  "1.0.0-alpha.0valid",
  "1.0.0-alpha-a.b-c-somethinglong+build.1-aef.1-its-okay",
  "1.0.0-rc.1+build.1",
  "2.0.0-rc.1+build.123",
  "1.2.3-beta",
  "10.2.3-DEV-SNAPSHOT",
  "1.2.3-SNAPSHOT-123",
  "1.0.0",
  "2.0.0",
  "1.1.7",
  "2.0.0+build.1848",
  "2.0.1-alpha.1227",
  "1.0.0-alpha+beta",
  "1.2.3----RC-SNAPSHOT.12.9.1--.12+788",
  "1.2.3----R-S.12.9.1--.12+meta",
  "1.2.3----RC-SNAPSHOT.12.9.1--.12",
  "1.0.0+0.build.1-rc.10000aaa-kk-0.1",
  "1.0.0-0A.is.legal",
  "1.0.0-0",
  "1.0.0-alpha.0",
  "1.0.0+0",
  "1.0.0+001.002",
];

test("every valid version is accepted", () => {
  for (const text of VALID) {
    assert.equal(isValidVersion(text), true, `isValidVersion(${text})`);
    assert.notEqual(tryParseVersion(text), null, `tryParseVersion(${text})`);
    assert.doesNotThrow(() => parseVersion(text), text);
  }
});

test("a valid version formats back to the text it came from", () => {
  for (const text of VALID) assert.equal(formatVersion(parseVersion(text)), text);
});

test("the version from the report", () => {
  assert.deepEqual(parseVersion("2.1.0-rc.1+build.7"), {
    major: 2,
    minor: 1,
    patch: 0,
    prerelease: ["rc", "1"],
    build: ["build", "7"],
  });
});

test("hyphens belong to the identifier", () => {
  assert.deepEqual(parseVersion("1.0.0-x-y-z.--").prerelease, ["x-y-z", "--"]);
  assert.deepEqual(parseVersion("1.0.0+21AF26D3----117B344092BD").build, ["21AF26D3----117B344092BD"]);
  assert.deepEqual(parseVersion("1.0.0-alpha-a.b-c+build.1-aef.1-its-okay"), {
    major: 1,
    minor: 0,
    patch: 0,
    prerelease: ["alpha-a", "b-c"],
    build: ["build", "1-aef", "1-its-okay"],
  });
});

test("identifiers keep their text, including leading zeros in build metadata", () => {
  assert.deepEqual(parseVersion("1.0.0-alpha+001").build, ["001"]);
  assert.deepEqual(parseVersion("1.0.0-0A.is.legal").prerelease, ["0A", "is", "legal"]);
  assert.deepEqual(parseVersion("1.0.0-alpha.0").prerelease, ["alpha", "0"]);
});

test("the three numbers are numbers", () => {
  const v = parseVersion("10.20.30");
  assert.deepEqual([v.major, v.minor, v.patch], [10, 20, 30]);
});
