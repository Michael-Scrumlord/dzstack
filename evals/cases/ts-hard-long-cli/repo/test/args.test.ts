import { test } from "node:test";
import assert from "node:assert/strict";
import { parseOptions } from "../src/args.ts";
import { UsageError } from "../src/errors.ts";

const spec = { due: "string", tag: "list", all: "flag" } as const;

test("positionals, values, lists and flags", () => {
  const parsed = parseOptions(["Buy", "--due", "2026-05-03", "milk", "--tag=a", "--tag", "b", "--all"], spec);
  assert.deepEqual(parsed.positionals, ["Buy", "milk"]);
  assert.deepEqual(parsed.values, { due: "2026-05-03" });
  assert.deepEqual(parsed.lists, { tag: ["a", "b"] });
  assert.ok(parsed.flags.has("all"));
});

test("the argument after an option is its value, whatever it looks like", () => {
  assert.deepEqual(parseOptions(["--due", "--all"], spec).values, { due: "--all" });
  assert.deepEqual(parseOptions(["--due", "-3"], spec).values, { due: "-3" });
});

test("a dash alone or a single dash is a positional; -- ends the options", () => {
  assert.deepEqual(parseOptions(["-5", "-x", "--", "--all"], spec).positionals, ["-5", "-x", "--all"]);
});

test("problems are usage errors", () => {
  assert.throws(() => parseOptions(["--colour"], spec), new UsageError('unknown option "--colour"'));
  assert.throws(() => parseOptions(["--due"], spec), new UsageError('option "--due" needs a value'));
  assert.throws(() => parseOptions(["--all=1"], spec), new UsageError('option "--all" does not take a value'));
  assert.throws(() => parseOptions(["--toString"], spec), { name: "UsageError" });
});
