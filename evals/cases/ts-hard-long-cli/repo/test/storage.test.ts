import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import * as nodeFs from "node:fs";
import { join } from "node:path";
import { readStore, writeStore } from "../src/storage.ts";
import { emptyStore } from "../src/task.ts";
import { tempDir, task } from "./helpers.ts";

test("a missing file reads as an empty store", () => {
  assert.deepEqual(readStore(join(tempDir(), "nope.json"), nodeFs), emptyStore());
});

test("what is written reads back, formatted as the store format says", () => {
  const path = join(tempDir(), "tasks.json");
  const store = { ...emptyStore(), nextId: 3, tasks: [task({ id: 1, tags: ["a"] }), task({ id: 2 })] };
  writeStore(path, store, nodeFs);
  const text = readFileSync(path, "utf8");
  assert.equal(text, `${JSON.stringify(store, null, 2)}\n`);
  assert.deepEqual(readStore(path, nodeFs), store);
});

test("a store from before the journal reads with an empty one", () => {
  const path = join(tempDir(), "old.json");
  writeFileSync(path, JSON.stringify({ version: 1, nextId: 2, tasks: [task({ id: 1 })] }));
  assert.deepEqual(readStore(path, nodeFs).journal, []);
});

test("files that are not stores are refused with exit code 65", () => {
  const dir = tempDir();
  const cases: Array<[string, string, RegExp]> = [
    ["garbage", "{nope", /is not a valid task store$/],
    ["array", "[]", /is not a valid task store$/],
    ["version", JSON.stringify({ version: 2, nextId: 1, tasks: [] }), /has unsupported store version 2$/],
    ["no version", JSON.stringify({ nextId: 1, tasks: [] }), /is not a valid task store$/],
    ["bad task", JSON.stringify({ version: 1, nextId: 2, tasks: [{ id: 1 }] }), /is not a valid task store$/],
    ["nextId too low", JSON.stringify({ version: 1, nextId: 1, tasks: [task({ id: 1 })] }), /is not a valid task store$/],
  ];
  for (const [name, text, message] of cases) {
    const path = join(dir, `${name}.json`);
    writeFileSync(path, text);
    assert.throws(() => readStore(path, nodeFs), (error: any) => error.exitCode === 65 && message.test(error.message), name);
  }
});

test("a file that cannot be read is exit code 74", () => {
  assert.throws(() => readStore(tempDir(), nodeFs), (error: any) => error.exitCode === 74 && /^cannot read /.test(error.message));
});
