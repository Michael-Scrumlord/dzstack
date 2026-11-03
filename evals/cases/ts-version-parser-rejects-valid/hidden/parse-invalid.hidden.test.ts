import { test } from "node:test";
import assert from "node:assert/strict";
import { InvalidVersionError, isValidVersion, parseVersion, tryParseVersion } from "../src/semver.ts";

// Invalid versions: the regex test list published on semver.org, plus the cases the README spells out
// (leading zeros, empty identifiers, whitespace, a v prefix, characters outside [0-9A-Za-z-]).
const INVALID = [
  "",
  "1",
  "1.2",
  "1.2.3.4",
  "1.2.3-0123",
  "1.2.3-0123.0123",
  "1.1.2+.123",
  "+invalid",
  "-invalid",
  "-invalid+invalid",
  "-invalid.01",
  "alpha",
  "alpha.beta",
  "alpha.beta.1",
  "alpha.1",
  "alpha+beta",
  "alpha_beta",
  "alpha.",
  "alpha..",
  "beta",
  "1.0.0-alpha_beta",
  "-alpha.",
  "1.0.0-alpha..",
  "1.0.0-alpha..1",
  "1.0.0-alpha...1",
  "1.0.0-alpha....1",
  "01.1.1",
  "1.01.1",
  "1.1.01",
  "1.2.3.DEV",
  "1.2-SNAPSHOT",
  "1.2.31.2.3----RC-SNAPSHOT.12.09.1--..12+788",
  "1.2-RC-SNAPSHOT",
  "-1.0.3-gamma+b7718",
  "+justmeta",
  "9.8.7+meta+meta",
  "9.8.7-whatever+meta+meta",
  "1.0.0-",
  "1.0.0+",
  "1.0.0-+build",
  "1.0.0-rc.1+",
  "1.0.0-rc..1",
  "1.0.0-.rc",
  "1.0.0-rc.",
  "1.0.0-rc.01",
  "1.0.0-00",
  "1.0.0+build..1",
  "1.0.0+.build",
  "1.0.0+build.",
  "1.0.0-rc.1+build 7",
  "-1.2.3",
  "1.-2.3",
  "v1.2.3",
  "V1.2.3",
  " 1.2.3",
  "1.2.3 ",
  "1.2.3\n",
  "1.0.0-rc 1",
  "1.0.0-été",
  "1.0.0+build.é",
  "1.0.0-rc_1",
];

test("every invalid version is rejected", () => {
  for (const text of INVALID) {
    assert.equal(isValidVersion(text), false, `isValidVersion(${JSON.stringify(text)})`);
    assert.equal(tryParseVersion(text), null, `tryParseVersion(${JSON.stringify(text)})`);
    assert.throws(() => parseVersion(text), InvalidVersionError, JSON.stringify(text));
  }
});

test("leading zeros are rejected in all three numbers and in numeric pre-release identifiers", () => {
  for (const text of ["01.0.0", "1.00.0", "1.0.00", "1.0.0-01", "1.0.0-alpha.007"]) {
    assert.equal(isValidVersion(text), false, text);
  }
});
