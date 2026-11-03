import { test } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { cli, tempDir, task, writeStoreFile } from "./helpers.ts";

test("list on a missing file says there are no tasks", async () => {
  const store = join(tempDir(), "tasks.json");
  const result = await cli(["--store", store, "list"]);
  assert.deepEqual(result, { code: 0, stdout: "No tasks.\n", stderr: "" });
});

test("list shows open tasks by priority, then due date, then id", async () => {
  const store = join(tempDir(), "tasks.json");
  writeStoreFile(store, [
    task({ id: 1, title: "Low, soon", priority: "low", due: "2026-05-02" }),
    task({ id: 2, title: "High, no date", priority: "high" }),
    task({ id: 3, title: "High, dated", priority: "high", due: "2026-06-01" }),
    task({ id: 4, title: "Normal", due: "2026-05-09" }),
    task({ id: 5, title: "Finished", status: "done", completedAt: "2026-05-01" }),
  ]);
  const result = await cli(["--store", store, "list"]);
  assert.equal(
    result.stdout,
    [
      "ID  PRI     DUE         TITLE",
      " 3  high    2026-06-01  High, dated",
      " 2  high    -           High, no date",
      " 4  normal  2026-05-09  Normal",
      " 1  low     2026-05-02  Low, soon",
      "",
    ].join("\n"),
  );
});

test("list --all includes done tasks and marks them", async () => {
  const store = join(tempDir(), "tasks.json");
  writeStoreFile(store, [task({ id: 1, title: "Open" }), task({ id: 2, title: "Finished", status: "done", completedAt: "2026-05-01" })]);
  const result = await cli(["--store", store, "list", "--all"]);
  assert.match(result.stdout, / 2 {2}normal {2}- {11}Finished \(done\)\n$/);
});

test("long titles are cut and wide ids widen the column", async () => {
  const store = join(tempDir(), "tasks.json");
  writeStoreFile(store, [task({ id: 100, title: "x".repeat(60) })]);
  const result = await cli(["--store", store, "list"]);
  assert.equal(result.stdout.split("\n")[1], `100  normal  -           ${"x".repeat(39)}…`);
});

test("TASKS_FILE names the store when --store is not given", async () => {
  const store = join(tempDir(), "elsewhere.json");
  writeStoreFile(store, [task({ id: 1, title: "From the environment" })]);
  const result = await cli(["list"], { TASKS_FILE: store });
  assert.match(result.stdout, /From the environment/);
});

test("usage problems exit with 2 and say so on standard error", async () => {
  assert.deepEqual(await cli(["frob"]), { code: 2, stdout: "", stderr: 'tasks: unknown command "frob"\n' });
  assert.deepEqual(await cli(["list", "extra"]), { code: 2, stdout: "", stderr: 'tasks: list: unexpected argument "extra"\n' });
  assert.deepEqual(await cli(["list", "--wide"]), { code: 2, stdout: "", stderr: 'tasks: list: unknown option "--wide"\n' });
  const none = await cli([]);
  assert.equal(none.code, 2);
  assert.match(none.stderr, /^Usage: tasks /);
});

test("help prints the usage", async () => {
  const result = await cli(["help"]);
  assert.equal(result.code, 0);
  assert.match(result.stdout, /^Usage: tasks \[--store PATH\] <command> \[arguments\]\n/);
});
