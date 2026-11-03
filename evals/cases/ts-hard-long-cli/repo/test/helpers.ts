import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { run } from "../src/cli.ts";
import type { Store, Task } from "../src/task.ts";

export function tempDir(): string {
  return mkdtempSync(join(tmpdir(), "tasks-test-"));
}

export function task(overrides: Partial<Task> & { id: number }): Task {
  return {
    title: `Task ${overrides.id}`,
    status: "open",
    priority: "normal",
    due: null,
    tags: [],
    note: null,
    createdAt: "2026-05-01",
    completedAt: null,
    ...overrides,
  };
}

export function writeStoreFile(path: string, tasks: Task[], extra: Partial<Store> = {}): void {
  const nextId = Math.max(0, ...tasks.map((t) => t.id)) + 1;
  const store: Store = { version: 1, nextId, tasks, journal: [], ...extra };
  writeFileSync(path, `${JSON.stringify(store, null, 2)}\n`);
}

export function readStoreFile(path: string): Store {
  return JSON.parse(readFileSync(path, "utf8")) as Store;
}

/** Runs the command line in this process and collects its output. */
export async function cli(args: string[], env: Record<string, string> = {}) {
  let stdout = "";
  let stderr = "";
  const code = await run(args, {
    stdout: (text) => void (stdout += text),
    stderr: (text) => void (stderr += text),
    env: { TASKS_TODAY: "2026-05-01", ...env },
  });
  return { code, stdout, stderr };
}
