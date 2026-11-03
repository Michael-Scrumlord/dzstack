import { test } from "node:test";
import assert from "node:assert/strict";
import { InvalidVersionError, compareVersions, parseVersion, sortVersions } from "../src/semver.ts";

// Spec item 11.
const CHAIN = [
  "1.0.0-alpha",
  "1.0.0-alpha.1",
  "1.0.0-alpha.beta",
  "1.0.0-beta",
  "1.0.0-beta.2",
  "1.0.0-beta.11",
  "1.0.0-rc.1",
  "1.0.0",
];

const lt = (a: string, b: string) => {
  assert.equal(compareVersions(a, b), -1, `${a} < ${b}`);
  assert.equal(compareVersions(b, a), 1, `${b} > ${a}`);
};
const eq = (a: string, b: string) => {
  assert.equal(compareVersions(a, b) === 0, true, `${a} = ${b}`);
  assert.equal(compareVersions(b, a) === 0, true, `${b} = ${a}`);
};

test("the spec's pre-release chain is strictly increasing, for every pair", () => {
  for (let i = 0; i < CHAIN.length; i++) {
    eq(CHAIN[i], CHAIN[i]);
    for (let j = i + 1; j < CHAIN.length; j++) lt(CHAIN[i], CHAIN[j]);
  }
});

test("sorting puts the chain in order", () => {
  const shuffled = [CHAIN[5], CHAIN[0], CHAIN[7], CHAIN[2], CHAIN[6], CHAIN[1], CHAIN[4], CHAIN[3]];
  assert.deepEqual(sortVersions(shuffled), CHAIN);
  assert.deepEqual(sortVersions([...CHAIN].reverse()), CHAIN);
});

test("major, minor and patch compare numerically", () => {
  const core = ["1.0.0", "1.9.0", "1.10.0", "2.0.0", "2.1.0", "2.1.1", "2.1.10", "10.0.0"];
  for (let i = 0; i < core.length - 1; i++) lt(core[i], core[i + 1]);
});

test("a pre-release is lower than its release and higher than the release before", () => {
  lt("2.1.0-rc.1+build.7", "2.1.0");
  lt("2.0.0", "2.1.0-rc.1+build.7");
  lt("2.1.0-rc.1+build.7", "2.1.0-rc.2");
});

test("digits-only identifiers compare numerically", () => {
  lt("1.0.0-alpha.9", "1.0.0-alpha.10");
  lt("1.0.0-2", "1.0.0-10");
  lt("1.0.0-rc.2", "1.0.0-rc.11");
  lt("1.0.0-0", "1.0.0-1");
});

test("a digits-only identifier is lower than one with letters or hyphens", () => {
  lt("1.0.0-99", "1.0.0-1a");
  lt("1.0.0-2", "1.0.0-1a");
  lt("1.0.0-1", "1.0.0--");
  lt("1.0.0-1", "1.0.0-alpha");
  lt("1.0.0-alpha.1", "1.0.0-alpha.beta");
  lt("1.0.0-alpha.1", "1.0.0-alpha.0a");
});

test("identifiers with letters or hyphens compare lexically in ASCII order, even when they start with digits", () => {
  lt("1.0.0-1a", "1.0.0-1b");
  lt("1.0.0-10y", "1.0.0-2x");
  lt("1.0.0-0A.is.legal", "1.0.0-0B.is.legal");
  lt("1.0.0-alpha0", "1.0.0-alpha1");
  lt("1.0.0-alpha10", "1.0.0-alpha2");
  lt("1.0.0-a-b", "1.0.0-a0");
  lt("1.0.0-Beta", "1.0.0-alpha");
  lt("1.0.0-Z", "1.0.0-a");
  lt("1.0.0-RC.1", "1.0.0-rc.1");
});

test("with equal shared identifiers the longer list is higher", () => {
  lt("1.0.0-alpha", "1.0.0-alpha.1");
  lt("1.0.0-alpha.1", "1.0.0-alpha.1.1");
  lt("1.0.0-alpha.beta", "1.0.0-alpha.beta.1");
});

test("a difference earlier in the list wins over a longer list", () => {
  lt("1.0.0-alpha.5.5.5", "1.0.0-beta");
  lt("1.0.0-alpha.1.9", "1.0.0-alpha.2");
});

test("build metadata is ignored", () => {
  eq("1.0.0+a", "1.0.0+b");
  eq("1.0.0+001", "1.0.0");
  eq("1.0.0-rc.1+build.5", "1.0.0-rc.1+build.9");
  eq("1.0.0-rc.1+build.5", "1.0.0-rc.1");
  lt("1.0.0-rc.1+zzz", "1.0.0-rc.2+aaa");
  lt("1.0.0-alpha+z", "1.0.0-alpha.1+a");
  lt("1.0.0+zzz", "1.0.1+aaa");
});

test("antisymmetry across the whole set", () => {
  const all = [...CHAIN, "0.9.0", "1.0.0-0", "1.0.0-1a", "1.0.0--", "1.0.0-10y", "1.0.0-2x", "2.1.0-rc.1+build.7", "2.1.0"];
  for (const a of all) {
    for (const b of all) assert.equal(compareVersions(a, b) === -compareVersions(b, a), true, `${a} vs ${b}`);
  }
});

test("compareVersions takes parsed versions too", () => {
  assert.equal(compareVersions(parseVersion("1.0.0-beta.2"), "1.0.0-beta.11"), -1);
  assert.equal(compareVersions("1.0.0-rc.1", parseVersion("1.0.0")), -1);
  assert.equal(compareVersions(parseVersion("1.0.0-rc.1+x"), parseVersion("1.0.0-rc.1+y")) === 0, true);
});

test("compareVersions throws for text that isn't a version", () => {
  assert.throws(() => compareVersions("1.2", "1.0.0"), InvalidVersionError);
  assert.throws(() => compareVersions("1.0.0", "1.0.0-alpha..1"), InvalidVersionError);
});
