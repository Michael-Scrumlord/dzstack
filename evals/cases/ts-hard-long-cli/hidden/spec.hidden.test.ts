import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const MAIN = join(import.meta.dirname, "..", "src", "main.ts");
const TODAY = "2026-05-01";

// ---------- running the program ----------

interface Result {
  code: number | null;
  stdout: string;
  stderr: string;
}

function dir(): string {
  return mkdtempSync(join(tmpdir(), "tasks-hidden-"));
}

function runRaw(args: string[], env: Record<string, string> = {}): Result {
  const result = spawnSync(process.execPath, [MAIN, ...args], {
    encoding: "utf8",
    env: { PATH: process.env.PATH ?? "", HOME: tmpdir(), NODE_NO_WARNINGS: "1", ...env },
  });
  return { code: result.status, stdout: result.stdout, stderr: result.stderr };
}

/** Runs the command against `store`, with today fixed (unless the environment says otherwise). */
function tasks(store: string, args: string[], env: Record<string, string> = {}): Result {
  return runRaw(["--store", store, ...args], { TASKS_TODAY: TODAY, ...env });
}

// ---------- stores ----------

interface T {
  id: number;
  title: string;
  status: "open" | "done";
  priority: "high" | "normal" | "low";
  due: string | null;
  tags: string[];
  note: string | null;
  createdAt: string;
  completedAt: string | null;
}

function t(id: number, overrides: Partial<T> = {}): T {
  return { id, title: `Task ${id}`, status: "open", priority: "normal", due: null, tags: [], note: null, createdAt: "2026-04-01", completedAt: null, ...overrides };
}

function doneT(id: number, completedAt: string, overrides: Partial<T> = {}): T {
  return t(id, { status: "done", completedAt, ...overrides });
}

interface Made {
  path: string;
  dir: string;
}

/** A store file in its own directory; `compact` writes it in a form the program would never write. */
function makeStore(list: T[], extra: Record<string, unknown> = {}, compact = false): Made {
  const d = dir();
  const path = join(d, "tasks.json");
  const nextId = Math.max(0, ...list.map((x) => x.id)) + 1;
  const store = { version: 1, nextId, tasks: list, journal: [], ...extra };
  writeFileSync(path, compact ? JSON.stringify(store) : `${JSON.stringify(store, null, 2)}\n`);
  return { path, dir: d };
}

function emptyPath(): Made {
  const d = dir();
  return { path: join(d, "tasks.json"), dir: d };
}

const readText = (path: string) => readFileSync(path, "utf8");
const readJson = (path: string) => JSON.parse(readText(path));
const files = (d: string) => readdirSync(d).sort();

function assertOk(result: Result, stdout: string) {
  assert.deepEqual(result, { code: 0, stdout, stderr: "" });
}

function assertFails(result: Result, code: number, stderr: string) {
  assert.deepEqual(result, { code, stdout: "", stderr });
}

/** The program failed and the file is exactly as it was. */
function assertRefused(made: Made, args: string[], code: number, stderr: string, env: Record<string, string> = {}) {
  const before = existsSync(made.path) ? readText(made.path) : undefined;
  assertFails(tasks(made.path, args, env), code, stderr);
  const after = existsSync(made.path) ? readText(made.path) : undefined;
  assert.equal(after, before, `${args.join(" ")}: the store file changed`);
  assert.deepEqual(files(made.dir), before === undefined ? [] : ["tasks.json"], `${args.join(" ")}: files were left behind`);
}

// ---------- general ----------

const USAGE = `Usage: tasks [--store PATH] <command> [arguments]

Commands:
  add <title...> [options]  add a task
  done <id>...              mark tasks done
  undo                      undo the last change
  edit <id> [options]       change a task
  list [--all]              list open tasks
  report [options]          summarise the tasks
  help                      show this text
`;

test("[general] help lists every command, and no command prints it on standard error", () => {
  assertOk(runRaw(["help"]), USAGE);
  assert.deepEqual(runRaw([]), { code: 2, stdout: "", stderr: USAGE });
});

test("[general] an unknown command and a broken global option", () => {
  assertFails(runRaw(["frob"]), 2, 'tasks: unknown command "frob"\n');
  assertFails(runRaw(["--store"]), 2, 'tasks: option "--store" needs a value\n');
});

test("[general] the store is found through --store, --store=, TASKS_FILE or tasks.json", () => {
  const a = makeStore([t(1, { title: "From a" })]);
  const b = makeStore([t(1, { title: "From b" })]);
  assert.match(runRaw(["--store", a.path, "list"]).stdout, /From a/);
  assert.match(runRaw([`--store=${b.path}`, "list"]).stdout, /From b/);
  assert.match(runRaw(["list"], { TASKS_FILE: b.path }).stdout, /From b/);
  assert.match(runRaw(["--store", a.path, "list"], { TASKS_FILE: b.path }).stdout, /From a/);
  const cwd = dir();
  writeFileSync(join(cwd, "tasks.json"), readText(a.path));
  const result = spawnSync(process.execPath, [MAIN, "list"], { cwd, encoding: "utf8", env: { PATH: process.env.PATH ?? "", NODE_NO_WARNINGS: "1" } });
  assert.match(result.stdout, /From a/);
});

test("[general] a TASKS_TODAY that is not a date is a usage error where today is needed", () => {
  const made = makeStore([t(1)]);
  for (const bad of ["tomorrow", "2026-02-30", "26-05-01", "2026-5-1"]) {
    const env = { TASKS_TODAY: bad };
    assertRefused(made, ["add", "x"], 2, "tasks: add: TASKS_TODAY must be a date like 2026-05-01\n", env);
    assertRefused(made, ["done", "1"], 2, "tasks: done: TASKS_TODAY must be a date like 2026-05-01\n", env);
    assertRefused(made, ["report"], 2, "tasks: report: TASKS_TODAY must be a date like 2026-05-01\n", env);
    assertRefused(made, ["edit", "1", "--due", "+1d"], 2, "tasks: edit: TASKS_TODAY must be a date like 2026-05-01\n", env);
  }
});

test("[general] without TASKS_TODAY today is the local date", () => {
  const zone = "Pacific/Kiritimati"; // a day ahead of UTC for most of the day
  const local = () => new Date().toLocaleDateString("sv-SE", { timeZone: zone });
  const made = emptyPath();
  const before = local();
  const result = runRaw(["--store", made.path, "add", "x"], { TZ: zone });
  const after = local();
  assert.equal(result.code, 0);
  assert.ok([before, after].includes(readJson(made.path).tasks[0].createdAt), "createdAt is not the local date");
});

test("[general] a damaged store is exit code 65, a store that cannot be read is 74", () => {
  const d = dir();
  const bad = join(d, "bad.json");
  writeFileSync(bad, "{nope");
  assertFails(tasks(bad, ["add", "x"]), 65, `tasks: ${bad} is not a valid task store\n`);
  assertFails(tasks(bad, ["report"]), 65, `tasks: ${bad} is not a valid task store\n`);
  writeFileSync(bad, JSON.stringify({ version: 2, nextId: 1, tasks: [] }));
  assertFails(tasks(bad, ["done", "1"]), 65, `tasks: ${bad} has unsupported store version 2\n`);
  const dirAsStore = join(d, "adir");
  mkdirSync(dirAsStore);
  const result = tasks(dirAsStore, ["add", "x"]);
  assert.equal(result.code, 74);
  assert.equal(result.stdout, "");
  assert.ok(result.stderr.startsWith(`tasks: cannot read ${dirAsStore}: `) && result.stderr.endsWith("\n"), result.stderr);
});

test("[general] arguments are checked before the store is read", () => {
  const d = dir();
  const bad = join(d, "bad.json");
  writeFileSync(bad, "{nope");
  assertFails(tasks(bad, ["add"]), 2, "tasks: add: missing title\n");
  assertFails(tasks(bad, ["done", "abc"]), 2, 'tasks: done: invalid id "abc"\n');
  assertFails(tasks(bad, ["edit", "1"]), 2, "tasks: edit: nothing to change\n");
  assertFails(tasks(bad, ["undo", "x"]), 2, 'tasks: undo: unexpected argument "x"\n');
  assertFails(tasks(bad, ["report", "--format", "xml"]), 2, 'tasks: report: invalid format "xml" (expected text or json)\n');
  assertFails(tasks(bad, ["undo"]), 65, `tasks: ${bad} is not a valid task store\n`);
});

test("[general] list still works on what the new commands write", () => {
  const made = emptyPath();
  tasks(made.path, ["add", "Write spec", "--priority", "high", "--due", "2026-05-03"]);
  tasks(made.path, ["add", "Relax"]);
  tasks(made.path, ["done", "2"]);
  assertOk(
    tasks(made.path, ["list"]),
    ["ID  PRI     DUE         TITLE", " 1  high    2026-05-03  Write spec", ""].join("\n"),
  );
  assertOk(
    tasks(made.path, ["list", "--all"]),
    ["ID  PRI     DUE         TITLE", " 1  high    2026-05-03  Write spec", " 2  normal  -           Relax (done)", ""].join("\n"),
  );
});

// ---------- dates (through add --due) ----------

function dueOf(text: string, today = TODAY, env: Record<string, string> = {}) {
  const made = emptyPath();
  const result = tasks(made.path, ["add", "x", "--due", text], { TASKS_TODAY: today, ...env });
  return { result, made };
}

const INVALID = (text: string) => `tasks: add: invalid date "${text}" (expected YYYY-MM-DD, today, tomorrow, yesterday, +Nd, -Nd, +Nw or -Nw)\n`;

test("[dates] ISO dates must be real calendar days", () => {
  for (const ok of ["2026-05-03", "2028-02-29", "2000-02-29", "1000-01-01", "9999-12-31", "2026-12-31"]) {
    assertOk(dueOf(ok).result, `Added #1: x (due ${ok})\n`);
  }
  for (const bad of ["2026-02-29", "2100-02-29", "2026-13-01", "2026-00-10", "2026-04-31", "2026-04-00", "0999-12-31", "0000-01-01", "2026-5-1", "2026-05-1", "26-05-01", " 2026-05-01", "2026-05-01 ", "2026-05-01T00:00", "20260501", "2026/05/01"]) {
    const { result, made } = dueOf(bad);
    assertFails(result, 2, INVALID(bad));
    assert.equal(existsSync(made.path), false, `${bad}: a store was created`);
  }
});

test("[dates] today, tomorrow and yesterday", () => {
  assertOk(dueOf("today").result, "Added #1: x (due 2026-05-01)\n");
  assertOk(dueOf("tomorrow").result, "Added #1: x (due 2026-05-02)\n");
  assertOk(dueOf("yesterday").result, "Added #1: x (due 2026-04-30)\n");
  for (const bad of ["Today", "TOMORROW", " today", "now", "yesterdays"]) assertFails(dueOf(bad).result, 2, INVALID(bad));
});

test("[dates] +Nd, -Nd, +Nw and -Nw count calendar days from today", () => {
  const cases: Array<[string, string]> = [
    ["+0d", "2026-05-01"], ["-0d", "2026-05-01"], ["+1d", "2026-05-02"], ["+3d", "2026-05-04"], ["+30d", "2026-05-31"], ["+31d", "2026-06-01"],
    ["-1d", "2026-04-30"], ["-30d", "2026-04-01"], ["-31d", "2026-03-31"], ["+0w", "2026-05-01"], ["+1w", "2026-05-08"], ["+2w", "2026-05-15"],
    ["-1w", "2026-04-24"], ["-4w", "2026-04-03"], ["+365d", "2027-05-01"], ["+9999d", "2053-09-15"], ["+52w", "2027-04-30"],
  ];
  for (const [text, expected] of cases) assertOk(dueOf(text).result, `Added #1: x (due ${expected})\n`);
  for (const bad of ["+d", "+12345d", "3d", "+3days", "+3D", "+1.5d", "++3d", "+-3d", "+3", "+3m", "d3", "+ 3d", "-"]) {
    assertFails(dueOf(bad).result, 2, INVALID(bad));
  }
});

test("[dates] month ends, leap days, year ends and time zones do not matter", () => {
  const cases: Array<[string, string, string]> = [
    ["2026-02-28", "+1d", "2026-03-01"],
    ["2028-02-28", "+1d", "2028-02-29"],
    ["2028-02-28", "+2d", "2028-03-01"],
    ["2028-03-01", "-1d", "2028-02-29"],
    ["2026-12-31", "+1d", "2027-01-01"],
    ["2026-01-01", "-1d", "2025-12-31"],
    ["2026-01-31", "+1w", "2026-02-07"],
    ["2026-03-08", "+1d", "2026-03-09"],
    ["2026-10-24", "+1d", "2026-10-25"],
    ["2026-10-25", "+1d", "2026-10-26"],
    ["2026-03-29", "tomorrow", "2026-03-30"],
    ["2026-11-01", "+1w", "2026-11-08"],
  ];
  for (const zone of ["UTC", "America/New_York", "Europe/London", "Pacific/Auckland"]) {
    for (const [today, text, expected] of cases) {
      assertOk(dueOf(text, today, { TZ: zone }).result, `Added #1: x (due ${expected})\n`);
    }
  }
});

test("[dates] a result outside the years 1000 to 9999 is invalid", () => {
  assertFails(dueOf("+1d", "9999-12-31").result, 2, INVALID("+1d"));
  assertOk(dueOf("-1d", "9999-12-31").result, "Added #1: x (due 9999-12-30)\n");
  assertFails(dueOf("-1d", "1000-01-01").result, 2, INVALID("-1d"));
  assertFails(dueOf("yesterday", "1000-01-01").result, 2, INVALID("yesterday"));
});

test("[dates] the same dates work for --since and edit --due", () => {
  const made = makeStore([t(1, { createdAt: "2026-04-24" }), t(2, { createdAt: "2026-04-23" })]);
  const lines = tasks(made.path, ["report", "--since", "-1w"]).stdout.split("\n");
  assert.equal(lines[1], "Filter: since=2026-04-24");
  assert.equal(lines[2], "Tasks: 1 (open 1, done 0)");
  assertFails(tasks(made.path, ["report", "--since", "2026-02-30"]), 2, 'tasks: report: invalid date "2026-02-30" (expected YYYY-MM-DD, today, tomorrow, yesterday, +Nd, -Nd, +Nw or -Nw)\n');
  assertOk(tasks(made.path, ["edit", "1", "--due", "+2w"]), "Edited #1 (due)\n");
  assert.equal(readJson(made.path).tasks[0].due, "2026-05-15");
  assertFails(tasks(made.path, ["edit", "1", "--due", "next week"]), 2, 'tasks: edit: invalid date "next week" (expected YYYY-MM-DD, today, tomorrow, yesterday, +Nd, -Nd, +Nw or -Nw)\n');
});

// ---------- add ----------

test("[add] adds a task and writes the store as documented", () => {
  const made = emptyPath();
  assertOk(tasks(made.path, ["add", "Buy milk"]), "Added #1: Buy milk\n");
  const text = readText(made.path);
  const store = JSON.parse(text);
  assert.equal(text, `${JSON.stringify(store, null, 2)}\n`);
  assert.deepEqual(store, {
    version: 1,
    nextId: 2,
    tasks: [{ id: 1, title: "Buy milk", status: "open", priority: "normal", due: null, tags: [], note: null, createdAt: TODAY, completedAt: null }],
    journal: [{ op: "add", id: 1 }],
  });
  assert.deepEqual(files(made.dir), ["tasks.json"]);
});

test("[add] the title is the words joined by single spaces, then trimmed", () => {
  const made = emptyPath();
  assertOk(tasks(made.path, ["add", "  Buy", "milk  "]), "Added #1: Buy milk\n");
  assertOk(tasks(made.path, ["add", "Walk   the dog"]), "Added #2: Walk   the dog\n");
  assertOk(tasks(made.path, ["add", "--", "--odd", "-5"]), "Added #3: --odd -5\n");
  assertOk(tasks(made.path, ["add", "-5", "apples"]), "Added #4: -5 apples\n");
  assertOk(tasks(made.path, ["add", "Fix", "--note=with equals"]), "Added #5: Fix\n");
  assert.deepEqual(readJson(made.path).tasks.map((x: T) => x.title), ["Buy milk", "Walk   the dog", "--odd -5", "-5 apples", "Fix"]);
  assert.equal(readJson(made.path).tasks[4].note, "with equals");
});

test("[add] every option, with values normalised", () => {
  const made = emptyPath();
  const result = tasks(made.path, ["add", "Pay rent", "--due", "2026-05-03", "--priority", "high", "--tag", "Home", "--tag", " money ", "--tag", "home", "--note", "  at the office  "]);
  assertOk(result, "Added #1: Pay rent (due 2026-05-03)\n");
  assert.deepEqual(readJson(made.path).tasks[0], {
    id: 1, title: "Pay rent", status: "open", priority: "high", due: "2026-05-03", tags: ["home", "money"], note: "at the office", createdAt: TODAY, completedAt: null,
  });
  assertOk(tasks(made.path, ["add", "Later", "--due=+1w", "--priority=low", "--tag=b", "--tag=a_1-x"]), "Added #2: Later (due 2026-05-08)\n");
  assert.deepEqual(readJson(made.path).tasks[1].tags, ["a_1-x", "b"]);
});

test("[add] tags are sorted by plain string comparison", () => {
  const made = emptyPath();
  tasks(made.path, ["add", "x", "--tag", "b", "--tag", "a", "--tag", "B2", "--tag", "9", "--tag", "a-1", "--tag", "a_1"]);
  assert.deepEqual(readJson(made.path).tasks[0].tags, ["9", "a", "a-1", "a_1", "b", "b2"]);
});

test("[add] the new id is nextId, which only ever goes up", () => {
  const made = makeStore([t(3)], { nextId: 10 });
  assertOk(tasks(made.path, ["add", "Next"]), "Added #10: Next\n");
  assertOk(tasks(made.path, ["add", "After"]), "Added #11: After\n");
  assert.equal(readJson(made.path).nextId, 12);
});

test("[add] a store from before the journal gets one", () => {
  const d = dir();
  const path = join(d, "tasks.json");
  writeFileSync(path, JSON.stringify({ version: 1, nextId: 2, tasks: [t(1)] }));
  assertOk(tasks(path, ["add", "More"]), "Added #2: More\n");
  assert.deepEqual(readJson(path).journal, [{ op: "add", id: 2 }]);
});

test("[add] the journal keeps the newest ten entries", () => {
  const journal = Array.from({ length: 10 }, (_, i) => ({ op: "add", id: i + 1 }));
  const made = makeStore(Array.from({ length: 10 }, (_, i) => t(i + 1)), { journal });
  assertOk(tasks(made.path, ["add", "Eleventh"]), "Added #11: Eleventh\n");
  assert.deepEqual(readJson(made.path).journal.map((e: { id: number }) => e.id), [2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
});

test("[add] title limits", () => {
  const made = emptyPath();
  assertOk(tasks(made.path, ["add", "x".repeat(80)]), `Added #1: ${"x".repeat(80)}\n`);
  assertOk(tasks(made.path, ["add", `  ${"y".repeat(80)}  `]), `Added #2: ${"y".repeat(80)}\n`);
  assertRefused(made, ["add", "x".repeat(81)], 2, "tasks: add: title is longer than 80 characters\n");
  assertRefused(made, ["add"], 2, "tasks: add: missing title\n");
  assertRefused(made, ["add", "   ", ""], 2, "tasks: add: missing title\n");
  assertRefused(made, ["add", "--priority", "high"], 2, "tasks: add: missing title\n");
});

test("[add] priority, tag, note and option errors", () => {
  const made = makeStore([t(1)]);
  assertRefused(made, ["add", "x", "--priority", "urgent"], 2, 'tasks: add: invalid priority "urgent" (expected high, normal or low)\n');
  assertRefused(made, ["add", "x", "--priority", "High"], 2, 'tasks: add: invalid priority "High" (expected high, normal or low)\n');
  for (const bad of ["Bad Tag", "-x", "", "a/b", "x".repeat(21), "ü"]) {
    assertRefused(made, ["add", "x", "--tag", bad], 2, `tasks: add: invalid tag "${bad}"\n`);
  }
  assertOk(tasks(made.path, ["add", "x", "--tag", "A".repeat(20)]), "Added #2: x\n");
  assertRefused(made, ["add", "x", "--note", "n".repeat(501)], 2, "tasks: add: note is longer than 500 characters\n");
  assertOk(tasks(made.path, ["add", "x", "--note", "n".repeat(500)]), "Added #3: x\n");
  assertOk(tasks(made.path, ["add", "x", "--note", "   "]), "Added #4: x\n");
  assert.equal(readJson(made.path).tasks[3].note, null);
  assertRefused(made, ["add", "x", "--colour", "red"], 2, 'tasks: add: unknown option "--colour"\n');
  assertRefused(made, ["add", "x", "--due"], 2, 'tasks: add: option "--due" needs a value\n');
  assertRefused(made, ["add", "x", "--tag"], 2, 'tasks: add: option "--tag" needs a value\n');
});

test("[add] at most ten tags", () => {
  const made = emptyPath();
  const tags = (n: number) => Array.from({ length: n }, (_, i) => ["--tag", `t${i}`]).flat();
  assertOk(tasks(made.path, ["add", "ten", ...tags(10)]), "Added #1: ten\n");
  assertRefused(made, ["add", "eleven", ...tags(11)], 2, "tasks: add: a task has at most 10 tags\n");
  assertOk(tasks(made.path, ["add", "dupes", ...tags(10), "--tag", "T3", "--tag", "t9"]), "Added #2: dupes\n");
});

test("[add] the checks run in the documented order", () => {
  const made = makeStore([t(1)]);
  const all = ["--priority", "nope", "--due", "nope", "--tag", "Bad Tag", "--note", "n".repeat(501)];
  assertRefused(made, ["add", ...all, "--colour", "x"], 2, 'tasks: add: unknown option "--colour"\n');
  assertRefused(made, ["add", "x".repeat(81), ...all], 2, "tasks: add: title is longer than 80 characters\n");
  assertRefused(made, ["add", "x", ...all], 2, 'tasks: add: invalid priority "nope" (expected high, normal or low)\n');
  assertRefused(made, ["add", "x", ...all.slice(2)], 2, INVALID("nope"));
  assertRefused(made, ["add", "x", ...all.slice(4)], 2, 'tasks: add: invalid tag "Bad Tag"\n');
  assertRefused(made, ["add", "x", ...all.slice(6)], 2, "tasks: add: note is longer than 500 characters\n");
});

test("[add] a failed add does not create the store, and a damaged store is left alone", () => {
  const missing = emptyPath();
  assertRefused(missing, ["add", "x", "--priority", "no"], 2, 'tasks: add: invalid priority "no" (expected high, normal or low)\n');
  assert.equal(existsSync(missing.path), false);
  const d = dir();
  const bad = join(d, "tasks.json");
  writeFileSync(bad, "[1, 2");
  assertFails(tasks(bad, ["add", "x"]), 65, `tasks: ${bad} is not a valid task store\n`);
  assert.equal(readText(bad), "[1, 2");
});

// ---------- done ----------

test("[done] marks tasks done in the order given and says so", () => {
  const made = makeStore([t(1, { title: "One" }), t(2, { title: "Two" }), t(3, { title: "Three" })]);
  assertOk(tasks(made.path, ["done", "3", "1"]), "Done #3: Three\nDone #1: One\n");
  const store = readJson(made.path);
  assert.deepEqual(store.tasks.map((x: T) => [x.id, x.status, x.completedAt]), [[1, "done", TODAY], [2, "open", null], [3, "done", TODAY]]);
  assert.deepEqual(store.journal, [{ op: "done", ids: [3, 1] }]);
  assert.equal(store.nextId, 4);
});

test("[done] repeated ids count once, and done tasks are reported without a change", () => {
  const made = makeStore([t(1, { title: "One" }), doneT(2, "2026-04-20", { title: "Two" }), t(3, { title: "Three" })]);
  assertOk(tasks(made.path, ["done", "1", "2", "1", "3", "2"]), "Done #1: One\nTask #2 is already done\nDone #3: Three\n");
  const store = readJson(made.path);
  assert.equal(store.tasks[1].completedAt, "2026-04-20", "an already done task keeps its completion date");
  assert.deepEqual(store.journal, [{ op: "done", ids: [1, 3] }]);
});

test("[done] when nothing changes nothing is written", () => {
  const made = makeStore([doneT(1, "2026-04-20", { title: "One" })], {}, true);
  const before = readText(made.path);
  assertOk(tasks(made.path, ["done", "1"]), "Task #1 is already done\n");
  assert.equal(readText(made.path), before);
  assert.deepEqual(files(made.dir), ["tasks.json"]);
});

test("[done] usage errors come first, then the first unknown id, and nothing changes", () => {
  const made = makeStore([t(1), t(2)]);
  assertRefused(made, ["done"], 2, "tasks: done: missing task id\n");
  // SPEC.md defines an id as [1-9][0-9]*, so a 20-digit id is valid syntax; how a missing one that
  // large prints is not settled, so it is not tested.
  for (const bad of ["abc", "0", "-1", "1.5", "01", "1e3", "", "+1"]) {
    assertRefused(made, ["done", "1", bad], 2, `tasks: done: invalid id "${bad}"\n`);
  }
  assertRefused(made, ["done", "9", "abc"], 2, 'tasks: done: invalid id "abc"\n');
  assertRefused(made, ["done", "--all"], 2, 'tasks: done: unknown option "--all"\n');
  assertRefused(made, ["done", "1", "9", "2"], 1, "tasks: done: no task #9\n");
  assertRefused(made, ["done", "8", "1", "9"], 1, "tasks: done: no task #8\n");
});

// ---------- undo ----------

test("[undo] with nothing to take back", () => {
  const made = emptyPath();
  assertRefused(made, ["undo"], 1, "tasks: undo: nothing to undo\n");
  const old = makeStore([t(1)]);
  assertRefused(old, ["undo"], 1, "tasks: undo: nothing to undo\n");
});

test("[undo] takes back an add, but ids are never reused", () => {
  const made = emptyPath();
  tasks(made.path, ["add", "First"]);
  tasks(made.path, ["add", "Second"]);
  assertOk(tasks(made.path, ["undo"]), "Undid add #2: Second\n");
  let store = readJson(made.path);
  assert.deepEqual(store.tasks.map((x: T) => x.id), [1]);
  assert.equal(store.nextId, 3);
  assert.deepEqual(store.journal, [{ op: "add", id: 1 }]);
  assertOk(tasks(made.path, ["add", "Third"]), "Added #3: Third\n");
  store = readJson(made.path);
  assert.deepEqual(store.tasks.map((x: T) => x.id), [1, 3]);
});

test("[undo] takes back a done, task by task in the order they were given", () => {
  const made = makeStore([t(1, { title: "One" }), t(2, { title: "Two" }), t(3, { title: "Three" })]);
  tasks(made.path, ["done", "3", "1"]);
  assertOk(tasks(made.path, ["undo"]), "Undid done #3: Three\nUndid done #1: One\n");
  const store = readJson(made.path);
  assert.deepEqual(store.tasks.map((x: T) => [x.status, x.completedAt]), [["open", null], ["open", null], ["open", null]]);
  assert.deepEqual(store.journal, []);
});

test("[undo] takes back an edit and restores exactly the saved fields", () => {
  const original = t(1, { title: "Old", due: "2026-05-09", priority: "low", note: "keep me", tags: ["a", "b"] });
  const made = makeStore([original]);
  tasks(made.path, ["edit", "1", "--title", "New", "--due", "none", "--priority", "high", "--note", "", "--tag", "z"]);
  assert.deepEqual(readJson(made.path).journal, [{ op: "edit", id: 1, before: { title: "Old", due: "2026-05-09", priority: "low", note: "keep me", tags: ["a", "b"] } }]);
  assertOk(tasks(made.path, ["undo"]), "Undid edit #1: Old\n");
  assert.deepEqual(readJson(made.path).tasks[0], original);
  tasks(made.path, ["edit", "1", "--priority", "high"]);
  tasks(made.path, ["edit", "1", "--title", "Later"]);
  assertOk(tasks(made.path, ["undo"]), "Undid edit #1: Old\n");
  const task = readJson(made.path).tasks[0];
  assert.deepEqual([task.title, task.priority], ["Old", "high"], "only the last edit is taken back");
});

test("[undo] walks back through the journal and adds nothing to it", () => {
  const made = emptyPath();
  tasks(made.path, ["add", "One"]);
  tasks(made.path, ["add", "Two"]);
  tasks(made.path, ["done", "1"]);
  tasks(made.path, ["edit", "2", "--title", "Deux"]);
  assertOk(tasks(made.path, ["undo"]), "Undid edit #2: Two\n");
  assertOk(tasks(made.path, ["undo"]), "Undid done #1: One\n");
  assertOk(tasks(made.path, ["undo"]), "Undid add #2: Two\n");
  assert.deepEqual(readJson(made.path).journal, [{ op: "add", id: 1 }]);
  assertOk(tasks(made.path, ["undo"]), "Undid add #1: One\n");
  assertRefused(made, ["undo"], 1, "tasks: undo: nothing to undo\n");
  assert.deepEqual(readJson(made.path), { version: 1, nextId: 3, tasks: [], journal: [] });
});

test("[undo] only the newest ten changes can be taken back", () => {
  const made = emptyPath();
  for (let i = 1; i <= 12; i++) tasks(made.path, ["add", `Task ${i}`]);
  for (let i = 12; i >= 3; i--) assertOk(tasks(made.path, ["undo"]), `Undid add #${i}: Task ${i}\n`);
  assertRefused(made, ["undo"], 1, "tasks: undo: nothing to undo\n");
  assert.deepEqual(readJson(made.path).tasks.map((x: T) => x.id), [1, 2]);
});

test("[undo] arguments are a usage error, checked first", () => {
  const made = emptyPath();
  assertRefused(made, ["undo", "1"], 2, 'tasks: undo: unexpected argument "1"\n');
  assertRefused(made, ["undo", "a", "b"], 2, 'tasks: undo: unexpected argument "a"\n');
  assertRefused(made, ["undo", "--force"], 2, 'tasks: undo: unknown option "--force"\n');
});

// ---------- edit ----------

test("[edit] changes one field at a time", () => {
  const made = makeStore([t(1, { title: "Old", due: "2026-05-09", priority: "low", note: "n", tags: ["a"] })]);
  const field = () => readJson(made.path).tasks[0];
  assertOk(tasks(made.path, ["edit", "1", "--title", "  New title "]), "Edited #1 (title)\n");
  assert.equal(field().title, "New title");
  assertOk(tasks(made.path, ["edit", "1", "--due", "2026-06-01"]), "Edited #1 (due)\n");
  assert.equal(field().due, "2026-06-01");
  assertOk(tasks(made.path, ["edit", "1", "--priority", "high"]), "Edited #1 (priority)\n");
  assert.equal(field().priority, "high");
  assertOk(tasks(made.path, ["edit", "1", "--note", "new note"]), "Edited #1 (note)\n");
  assert.equal(field().note, "new note");
  assertOk(tasks(made.path, ["edit", "1", "--tag", "x", "--tag", "Y"]), "Edited #1 (tags)\n");
  assert.deepEqual(field().tags, ["x", "y"]);
  assert.deepEqual(readJson(made.path).journal.map((e: any) => [e.op, Object.keys(e.before)]), [
    ["edit", ["title"]], ["edit", ["due"]], ["edit", ["priority"]], ["edit", ["note"]], ["edit", ["tags"]],
  ]);
});

test("[edit] several fields are listed in a fixed order", () => {
  const made = makeStore([t(1, { title: "Old", priority: "low" })]);
  const result = tasks(made.path, ["edit", "1", "--tag", "a", "--note", "x", "--due", "+1d", "--priority", "high", "--title", "T"]);
  assertOk(result, "Edited #1 (title, due, priority, note, tags)\n");
  assert.deepEqual(Object.keys(readJson(made.path).journal[0].before), ["title", "due", "priority", "note", "tags"]);
  assert.equal(readJson(made.path).tasks[0].due, "2026-05-02");
});

test("[edit] none clears the due date and an empty value clears the note", () => {
  const made = makeStore([t(1, { due: "2026-05-09", note: "n" })]);
  assertOk(tasks(made.path, ["edit", "1", "--due", "none", "--note", ""]), "Edited #1 (due, note)\n");
  assert.deepEqual([readJson(made.path).tasks[0].due, readJson(made.path).tasks[0].note], [null, null]);
  assertOk(tasks(made.path, ["edit", "1", "--due", "none"]), "No changes to #1\n");
  assertOk(tasks(made.path, ["edit", "1", "--note", "   "]), "No changes to #1\n");
});

test("[edit] --add-tag and --remove-tag change the list", () => {
  const made = makeStore([t(1, { tags: ["b", "c"] })]);
  const tags = () => readJson(made.path).tasks[0].tags;
  assertOk(tasks(made.path, ["edit", "1", "--add-tag", "A", "--add-tag", "d"]), "Edited #1 (tags)\n");
  assert.deepEqual(tags(), ["a", "b", "c", "d"]);
  assertOk(tasks(made.path, ["edit", "1", "--remove-tag", "B", "--add-tag", "e"]), "Edited #1 (tags)\n");
  assert.deepEqual(tags(), ["a", "c", "d", "e"]);
  assertOk(tasks(made.path, ["edit", "1", "--remove-tag", "a", "--remove-tag", "c"]), "Edited #1 (tags)\n");
  assert.deepEqual(tags(), ["d", "e"]);
  assertOk(tasks(made.path, ["edit", "1", "--add-tag", "D"]), "No changes to #1\n");
  assertOk(tasks(made.path, ["edit", "1", "--tag", "e", "--tag", "d"]), "No changes to #1\n");
  assertOk(tasks(made.path, ["edit", "1", "--tag", "d", "--tag", "d"]), "Edited #1 (tags)\n");
  assert.deepEqual(tags(), ["d"]);
});

test("[edit] a field is changed only if its value differs, and the journal records only those", () => {
  const made = makeStore([t(1, { title: "Same", priority: "normal", due: "2026-05-05" })]);
  assertOk(tasks(made.path, ["edit", "1", "--title", "Same", "--priority", "high", "--due", "2026-05-05"]), "Edited #1 (priority)\n");
  assert.deepEqual(readJson(made.path).journal, [{ op: "edit", id: 1, before: { priority: "normal" } }]);
});

test("[edit] nothing changed: no write and no journal entry", () => {
  const made = makeStore([t(1, { title: "Same", tags: ["a"] })], {}, true);
  const before = readText(made.path);
  assertOk(tasks(made.path, ["edit", "1", "--title", " Same ", "--priority", "normal", "--tag", "a"]), "No changes to #1\n");
  assert.equal(readText(made.path), before);
});

test("[edit] done tasks can be edited and stay done", () => {
  const made = makeStore([doneT(1, "2026-04-20", { title: "Finished" })]);
  assertOk(tasks(made.path, ["edit", "1", "--title", "Finished!"]), "Edited #1 (title)\n");
  const task = readJson(made.path).tasks[0];
  assert.deepEqual([task.status, task.completedAt], ["done", "2026-04-20"]);
});

test("[edit] usage errors, in the documented order", () => {
  const made = makeStore([t(1, { tags: ["a"] })]);
  assertRefused(made, ["edit"], 2, "tasks: edit: missing task id\n");
  assertRefused(made, ["edit", "--title", "x"], 2, "tasks: edit: missing task id\n");
  assertRefused(made, ["edit", "abc", "--title", "x"], 2, 'tasks: edit: invalid id "abc"\n');
  assertRefused(made, ["edit", "1", "2", "--title", "x"], 2, 'tasks: edit: unexpected argument "2"\n');
  assertRefused(made, ["edit", "9"], 2, "tasks: edit: nothing to change\n");
  assertRefused(made, ["edit", "1", "--colour", "x"], 2, 'tasks: edit: unknown option "--colour"\n');
  assertRefused(made, ["edit", "1", "--title"], 2, 'tasks: edit: option "--title" needs a value\n');
  assertRefused(made, ["edit", "1", "--tag", "x", "--add-tag", "y"], 2, "tasks: edit: --tag cannot be combined with --add-tag or --remove-tag\n");
  assertRefused(made, ["edit", "1", "--tag", "x", "--remove-tag", "y"], 2, "tasks: edit: --tag cannot be combined with --add-tag or --remove-tag\n");
  assertRefused(made, ["edit", "1", "--title", "  "], 2, "tasks: edit: title must not be empty\n");
  assertRefused(made, ["edit", "1", "--title", "x".repeat(81)], 2, "tasks: edit: title is longer than 80 characters\n");
  assertRefused(made, ["edit", "1", "--priority", "now"], 2, 'tasks: edit: invalid priority "now" (expected high, normal or low)\n');
  assertRefused(made, ["edit", "1", "--due", "None"], 2, INVALID("None").replace("add:", "edit:"));
  assertRefused(made, ["edit", "1", "--note", "n".repeat(501)], 2, "tasks: edit: note is longer than 500 characters\n");
  assertRefused(made, ["edit", "1", "--tag", "Bad Tag"], 2, 'tasks: edit: invalid tag "Bad Tag"\n');
  assertRefused(made, ["edit", "1", "--add-tag", "-x"], 2, 'tasks: edit: invalid tag "-x"\n');
  assertRefused(made, ["edit", "1", "--remove-tag", "a b"], 2, 'tasks: edit: invalid tag "a b"\n');
  assertRefused(made, ["edit", "1", "--add-tag", "X", "--remove-tag", "x"], 2, 'tasks: edit: "x" is both added and removed\n');
  assertRefused(made, ["edit", "1", "--tag", ...Array.from({ length: 11 }, (_, i) => `t${i}`).flatMap((x, i) => (i === 0 ? [x] : ["--tag", x]))], 2, "tasks: edit: a task has at most 10 tags\n");
  // checks come in order: title before priority before due before note before tags
  assertRefused(made, ["edit", "1", "--note", "n".repeat(501), "--priority", "no", "--title", "x".repeat(81)], 2, "tasks: edit: title is longer than 80 characters\n");
  assertRefused(made, ["edit", "1", "--note", "n".repeat(501), "--tag", "Bad Tag"], 2, "tasks: edit: note is longer than 500 characters\n");
  // and every usage error beats an unknown id
  assertRefused(made, ["edit", "9", "--title", ""], 2, "tasks: edit: title must not be empty\n");
});

test("[edit] an unknown id, a tag the task lacks, too many tags: exit code 1", () => {
  const made = makeStore([t(1, { tags: ["a", "b"] })]);
  assertRefused(made, ["edit", "9", "--title", "x"], 1, "tasks: edit: no task #9\n");
  assertRefused(made, ["edit", "1", "--title", "ok", "--remove-tag", "zzz"], 1, 'tasks: edit: task #1 has no tag "zzz"\n');
  assertRefused(made, ["edit", "1", "--remove-tag", "A", "--remove-tag", "Q", "--remove-tag", "R"], 1, 'tasks: edit: task #1 has no tag "q"\n');
  const crowded = makeStore([t(1, { tags: Array.from({ length: 10 }, (_, i) => `t${i}`) })]);
  assertRefused(crowded, ["edit", "1", "--add-tag", "extra"], 1, "tasks: edit: task #1 would have more than 10 tags\n");
  assertOk(tasks(crowded.path, ["edit", "1", "--add-tag", "t3", "--add-tag", "t4"]), "No changes to #1\n");
  assertOk(tasks(crowded.path, ["edit", "1", "--remove-tag", "t0", "--add-tag", "extra"]), "Edited #1 (tags)\n");
});

// ---------- report ----------

function reportStore() {
  return makeStore([
    t(1, { title: "Call dentist", due: "2026-04-30", priority: "normal", createdAt: "2026-04-02" }),
    t(2, { title: "Pay rent", due: "2026-04-28", priority: "high", tags: ["home", "money"], createdAt: "2026-04-03" }),
    t(3, { title: "Water plants", due: "2026-05-04", priority: "low", tags: ["home"], createdAt: "2026-04-10" }),
    t(4, { title: "Plan trip", due: "2026-05-08", priority: "normal", createdAt: "2026-04-15" }),
    t(5, { title: "Due today", due: "2026-05-01", priority: "high", createdAt: "2026-04-20" }),
    t(6, { title: "Someday", priority: "low", tags: ["money"], createdAt: "2026-03-01" }),
    t(7, { title: "Late but same day", due: "2026-04-28", priority: "normal", createdAt: "2026-04-03" }),
    t(8, { title: "Late and low", due: "2026-04-28", priority: "low", createdAt: "2026-04-03" }),
    doneT(9, "2026-04-25", { title: "Last week", due: "2026-04-20", priority: "high", tags: ["home"], createdAt: "2026-04-01" }),
    doneT(10, "2026-05-01", { title: "Today's win", due: "2026-04-01", priority: "low", createdAt: "2026-04-29" }),
    doneT(11, "2026-04-24", { title: "Too old", createdAt: "2026-04-01" }),
  ]);
}

test("[report] the text report", () => {
  const made = reportStore();
  assertOk(
    tasks(made.path, ["report"]),
    [
      "Report for 2026-05-01",
      "Tasks: 11 (open 8, done 3)",
      "Overdue (4):",
      "  #2 2026-04-28 high Pay rent [home,money]",
      "  #7 2026-04-28 normal Late but same day",
      "  #8 2026-04-28 low Late and low",
      "  #1 2026-04-30 normal Call dentist",
      "Due in the next 7 days (3):",
      "  #5 2026-05-01 high Due today",
      "  #3 2026-05-04 low Water plants [home]",
      "  #4 2026-05-08 normal Plan trip",
      "Open by priority: high 2, normal 3, low 3",
      "Completed in the last 7 days: 2",
      "",
    ].join("\n"),
  );
});

test("[report] the window for due soon is today to seven days ahead, ends included", () => {
  const made = makeStore([
    t(1, { due: "2026-05-01" }), t(2, { due: "2026-05-08" }), t(3, { due: "2026-05-09" }), t(4, { due: "2026-04-30" }),
  ]);
  const json = JSON.parse(tasks(made.path, ["report", "--format", "json"]).stdout);
  assert.deepEqual([json.overdue, json.dueSoon], [[4], [1, 2]]);
});

test("[report] the window for completed tasks is six days back to today", () => {
  const made = makeStore([doneT(1, "2026-04-25"), doneT(2, "2026-04-24"), doneT(3, "2026-05-01"), doneT(4, "2026-04-30")]);
  const json = JSON.parse(tasks(made.path, ["report", "--format", "json"]).stdout);
  assert.equal(json.completedLast7Days, 3);
});

test("[report] sections with nothing in them say none", () => {
  const made = emptyPath();
  assertOk(
    tasks(made.path, ["report"]),
    [
      "Report for 2026-05-01",
      "Tasks: 0 (open 0, done 0)",
      "Overdue (0):",
      "  none",
      "Due in the next 7 days (0):",
      "  none",
      "Open by priority: high 0, normal 0, low 0",
      "Completed in the last 7 days: 0",
      "",
    ].join("\n"),
  );
  assert.equal(existsSync(made.path), false, "report must not create the store");
});

test("[report] the JSON report", () => {
  const made = reportStore();
  const result = tasks(made.path, ["report", "--format", "json"]);
  const expected = {
    date: TODAY,
    filter: { tag: null, priority: null, since: null },
    total: 11,
    open: 8,
    done: 3,
    overdue: [2, 7, 8, 1],
    dueSoon: [5, 3, 4],
    openByPriority: { high: 2, normal: 3, low: 3 },
    completedLast7Days: 2,
  };
  assert.equal(result.stdout, `${JSON.stringify(expected, null, 2)}\n`);
  assert.deepEqual([result.code, result.stderr], [0, ""]);
  assert.equal(tasks(made.path, ["report", "--format=json"]).stdout, result.stdout);
  assert.equal(tasks(made.path, ["report", "--format", "text"]).stdout, tasks(made.path, ["report"]).stdout);
});

test("[report] filters narrow the selection, and the filter line says which", () => {
  const made = reportStore();
  assertOk(
    tasks(made.path, ["report", "--tag", "HOME"]),
    [
      "Report for 2026-05-01",
      "Filter: tag=home",
      "Tasks: 3 (open 2, done 1)",
      "Overdue (1):",
      "  #2 2026-04-28 high Pay rent [home,money]",
      "Due in the next 7 days (1):",
      "  #3 2026-05-04 low Water plants [home]",
      "Open by priority: high 1, normal 0, low 1",
      "Completed in the last 7 days: 1",
      "",
    ].join("\n"),
  );
  const json = JSON.parse(tasks(made.path, ["report", "--format", "json", "--priority", "low", "--since", "2026-04-10", "--tag", "home"]).stdout);
  assert.deepEqual(json.filter, { tag: "home", priority: "low", since: "2026-04-10" });
  assert.deepEqual([json.total, json.open, json.done, json.overdue, json.dueSoon], [1, 1, 0, [], [3]]);
  const text = tasks(made.path, ["report", "--since", "-3w", "--priority", "high", "--tag", "money"]).stdout.split("\n");
  assert.equal(text[1], "Filter: tag=money, priority=high, since=2026-04-10");
  assert.equal(text[2], "Tasks: 0 (open 0, done 0)");
  const byDate = JSON.parse(tasks(made.path, ["report", "--format", "json", "--since", "2026-04-20"]).stdout);
  assert.deepEqual([byDate.total, byDate.overdue, byDate.dueSoon, byDate.completedLast7Days], [2, [], [5], 1]);
});

test("[report] errors, and it never writes", () => {
  const made = makeStore([t(1)], {}, true);
  assertRefused(made, ["report", "now"], 2, 'tasks: report: unexpected argument "now"\n');
  assertRefused(made, ["report", "--format", "xml"], 2, 'tasks: report: invalid format "xml" (expected text or json)\n');
  assertRefused(made, ["report", "--format", "JSON"], 2, 'tasks: report: invalid format "JSON" (expected text or json)\n');
  assertRefused(made, ["report", "--tag", "No Good"], 2, 'tasks: report: invalid tag "No Good"\n');
  assertRefused(made, ["report", "--priority", "x"], 2, 'tasks: report: invalid priority "x" (expected high, normal or low)\n');
  assertRefused(made, ["report", "--since", "soon"], 2, INVALID("soon").replace("add:", "report:"));
  assertRefused(made, ["report", "--colour"], 2, 'tasks: report: unknown option "--colour"\n');
  assertRefused(made, ["report", "--format"], 2, 'tasks: report: option "--format" needs a value\n');
  const before = readText(made.path);
  assert.equal(tasks(made.path, ["report"]).code, 0);
  assert.equal(readText(made.path), before);
});

// ---------- writing the store safely ----------

const HOOK = `
import fs from "node:fs";
const log = (name, args) => fs.appendFileSync(process.env.HOOK_LOG, JSON.stringify({ name, args: args.slice(0, 2).map(String), pid: process.pid }) + "\\n");
const mode = process.env.HOOK_MODE ?? "";
export function writeFileSync(...args) {
  log("writeFileSync", args);
  if (mode === "partial-write") {
    fs.writeFileSync(args[0], String(args[1]).slice(0, 25));
    throw new Error("no space left on device");
  }
  return fs.writeFileSync(...args);
}
export function renameSync(...args) {
  log("renameSync", args);
  if (mode === "rename-fails") throw new Error("disk exploded");
  if (mode === "crash") process.exit(137);
  return fs.renameSync(...args);
}
export function unlinkSync(...args) {
  log("unlinkSync", args);
  if (mode === "unlink-fails") throw new Error("cannot remove");
  return fs.unlinkSync(...args);
}
export function readFileSync(...args) {
  log("readFileSync", args);
  if (mode === "read-fails") throw Object.assign(new Error("permission denied"), { code: "EACCES" });
  return fs.readFileSync(...args);
}
export function somethingElse() {
  throw new Error("only the four fs functions are hooks");
}
`;

function hooked(mode = "") {
  const d = dir();
  const hook = join(d, "hook.mjs");
  const logFile = join(d, "calls.log");
  writeFileSync(hook, HOOK);
  writeFileSync(logFile, "");
  const env = { TASKS_FS_HOOK: hook, HOOK_LOG: logFile, HOOK_MODE: mode };
  const calls = () => readText(logFile).split("\n").filter(Boolean).map((line) => JSON.parse(line) as { name: string; args: string[]; pid: number });
  return { env, calls };
}

const STORE_BEFORE = [t(1, { title: "Existing" })];

test("[atomic] a write goes to a temp file next to the store and is renamed over it", () => {
  const made = makeStore(STORE_BEFORE);
  const hook = hooked();
  assertOk(tasks(made.path, ["add", "New one"], hook.env), "Added #2: New one\n");
  const calls = hook.calls();
  const writes = calls.filter((c) => c.name === "writeFileSync");
  const renames = calls.filter((c) => c.name === "renameSync");
  assert.equal(writes.length, 1);
  assert.equal(renames.length, 1);
  const temp = `${made.path}.${writes[0]!.pid}.tmp`;
  assert.equal(writes[0]!.args[0], temp, "the text is written to <store>.<pid>.tmp");
  assert.deepEqual(renames[0]!.args, [temp, made.path]);
  assert.ok(calls.indexOf(writes[0]!) < calls.indexOf(renames[0]!));
  assert.equal(calls.some((c) => c.name === "writeFileSync" && c.args[0] === made.path), false, "nothing writes to the store path itself");
  assert.deepEqual(files(made.dir), ["tasks.json"]);
  assert.equal(readJson(made.path).tasks.length, 2);
  const text = readText(made.path);
  assert.equal(text, `${JSON.stringify(JSON.parse(text), null, 2)}\n`);
});

test("[atomic] every command that changes the store writes it that way", () => {
  const made = makeStore([t(1), t(2)]);
  const runs: string[][] = [["add", "x"], ["done", "1"], ["edit", "2", "--title", "y"]];
  for (const args of runs) {
    const hook = hooked();
    assert.equal(tasks(made.path, args, hook.env).code, 0);
    assert.deepEqual(hook.calls().map((c) => c.name).filter((n) => n !== "readFileSync"), ["writeFileSync", "renameSync"], args.join(" "));
  }
  const hook = hooked();
  assert.equal(tasks(made.path, ["undo"], hook.env).code, 0);
  assert.deepEqual(hook.calls().map((c) => c.name).filter((n) => n !== "readFileSync"), ["writeFileSync", "renameSync"], "undo");
});

test("[atomic] a failing rename leaves the store as it was and no temp file", () => {
  for (const args of [["add", "x"], ["done", "1"], ["edit", "1", "--title", "y"]]) {
    const made = makeStore([t(1)], { journal: [{ op: "add", id: 1 }] });
    const before = readText(made.path);
    const hook = hooked("rename-fails");
    assertFails(tasks(made.path, args, hook.env), 74, `tasks: cannot save ${made.path}: disk exploded\n`);
    assert.equal(readText(made.path), before, `${args[0]}: the store changed`);
    assert.deepEqual(files(made.dir), ["tasks.json"], `${args[0]}: a temp file was left`);
    const names = hook.calls().map((c) => c.name);
    assert.ok(names.includes("unlinkSync"), `${args[0]}: the temp file was not removed with unlinkSync`);
  }
  const made = makeStore([t(1)], { journal: [{ op: "add", id: 1 }] });
  const before = readText(made.path);
  assertFails(tasks(made.path, ["undo"], hooked("rename-fails").env), 74, `tasks: cannot save ${made.path}: disk exploded\n`);
  assert.equal(readText(made.path), before);
});

test("[atomic] a write that fails half way leaves the store as it was and no temp file", () => {
  const made = makeStore(STORE_BEFORE);
  const before = readText(made.path);
  const hook = hooked("partial-write");
  assertFails(tasks(made.path, ["add", "x"], hook.env), 74, `tasks: cannot save ${made.path}: no space left on device\n`);
  assert.equal(readText(made.path), before);
  assert.deepEqual(files(made.dir), ["tasks.json"]);
  const calls = hook.calls();
  assert.equal(calls.some((c) => c.name === "renameSync"), false, "no rename after a failed write");
  const unlink = calls.find((c) => c.name === "unlinkSync");
  assert.equal(unlink?.args[0], `${made.path}.${unlink?.pid}.tmp`);
});

test("[atomic] a failure to remove the temp file is not reported instead of the real error", () => {
  const made = makeStore(STORE_BEFORE);
  const hook = hooked("unlink-fails");
  // rename-fails and unlink-fails at once: both modes are one string in this hook, so use a second hook
  const d = dir();
  const both = join(d, "both.mjs");
  writeFileSync(both, `
    import fs from "node:fs";
    export function renameSync() { throw new Error("rename broke"); }
    export function unlinkSync() { throw new Error("unlink broke"); }
  `);
  void hook;
  assertFails(tasks(made.path, ["add", "x"], { TASKS_FS_HOOK: both }), 74, `tasks: cannot save ${made.path}: rename broke\n`);
  assert.equal(readJson(made.path).tasks.length, 1);
});

test("[atomic] a crash between the write and the rename leaves the store intact and later runs fine", () => {
  const made = makeStore(STORE_BEFORE);
  const before = readText(made.path);
  const stale = `${made.path}.99999.tmp`;
  writeFileSync(stale, "junk from an old crash");
  const crashed = tasks(made.path, ["add", "lost"], hooked("crash").env);
  assert.equal(crashed.code, 137);
  assert.equal(readText(made.path), before, "the store must not change when the process dies before the rename");
  assert.ok(files(made.dir).includes("tasks.json"));
  assertOk(tasks(made.path, ["list"]), ["ID  PRI     DUE         TITLE", " 1  normal  -           Existing", ""].join("\n"));
  assertOk(tasks(made.path, ["add", "after"]), "Added #2: after\n");
  assert.equal(readText(stale), "junk from an old crash", "a temp file of another process is left alone");
  assert.equal(readJson(made.path).tasks.length, 2);
});

test("[atomic] a store that cannot be read is exit code 74 and reads are the only thing hooked", () => {
  const made = makeStore(STORE_BEFORE);
  const hook = hooked("read-fails");
  assertFails(tasks(made.path, ["report"], hook.env), 74, `tasks: cannot read ${made.path}: permission denied\n`);
  assert.deepEqual(hook.calls().map((c) => [c.name, c.args[0]]), [["readFileSync", made.path]]);
});

test("[atomic] commands that change nothing do not write", () => {
  const made = makeStore([t(1, { title: "A", tags: ["x"] }), doneT(2, "2026-04-20")]);
  const runs: string[][] = [["list"], ["report"], ["done", "2"], ["edit", "1", "--title", "A"], ["help"]];
  for (const args of runs) {
    const hook = hooked();
    assert.equal(tasks(made.path, args, hook.env).code, 0, args.join(" "));
    const names = hook.calls().map((c) => c.name);
    assert.equal(names.includes("writeFileSync") || names.includes("renameSync"), false, `${args.join(" ")} wrote the store`);
  }
});

test("[atomic] failed commands do not write either", () => {
  const made = makeStore([t(1)]);
  const runs: string[][] = [["add"], ["done", "9"], ["edit", "9", "--title", "x"], ["undo"], ["report", "--format", "xml"]];
  for (const args of runs) {
    const hook = hooked();
    assert.notEqual(tasks(made.path, args, hook.env).code, 0, args.join(" "));
    const names = hook.calls().map((c) => c.name);
    assert.equal(names.includes("writeFileSync") || names.includes("renameSync"), false, `${args.join(" ")} wrote the store`);
  }
});

test("[atomic] a new store is created the same way", () => {
  const made = emptyPath();
  const hook = hooked();
  assertOk(tasks(made.path, ["add", "first"], hook.env), "Added #1: first\n");
  assert.deepEqual(hook.calls().map((c) => c.name).filter((n) => n !== "readFileSync"), ["writeFileSync", "renameSync"]);
  assert.deepEqual(files(made.dir), ["tasks.json"]);
});
