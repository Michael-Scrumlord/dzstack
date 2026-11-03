import { test } from "node:test";
import assert from "node:assert/strict";
import { formatTable, listOrder } from "../src/format.ts";
import { padEnd, padStart, plural, truncate } from "../src/text.ts";
import { task } from "./helpers.ts";

test("truncate keeps short text and ends cut text with an ellipsis", () => {
  assert.equal(truncate("short", 10), "short");
  assert.equal(truncate("exactly ten", 11), "exactly ten");
  assert.equal(truncate("a longer title than fits", 10), "a longer …");
});

test("padding and plurals", () => {
  assert.equal(padEnd("ab", 4), "ab  ");
  assert.equal(padStart("ab", 4), "  ab");
  assert.equal(padEnd("abcdef", 4), "abcdef");
  assert.equal(plural(1, "task"), "task");
  assert.equal(plural(2, "task"), "tasks");
  assert.equal(plural(0, "entry", "entries"), "entries");
});

test("an empty table says so", () => {
  assert.equal(formatTable([]), "No tasks.\n");
});

test("listOrder puts urgent work first without changing its input", () => {
  const tasks = [task({ id: 1, priority: "low" }), task({ id: 2, priority: "high", due: "2026-05-09" }), task({ id: 3, priority: "high" })];
  assert.deepEqual(listOrder(tasks).map((t) => t.id), [2, 3, 1]);
  assert.deepEqual(tasks.map((t) => t.id), [1, 2, 3]);
});
