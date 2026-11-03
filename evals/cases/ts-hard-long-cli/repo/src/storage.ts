import * as nodeFs from "node:fs";
import { DataError, IoError } from "./errors.ts";
import { emptyStore, PRIORITIES } from "./task.ts";
import type { JournalEntry, Store, Task } from "./task.ts";

/** The file system functions the store uses. */
export type FsApi = Pick<typeof nodeFs, "readFileSync" | "writeFileSync" | "renameSync" | "unlinkSync">;

export async function loadFsApi(_env: NodeJS.ProcessEnv): Promise<FsApi> {
  return nodeFs;
}

const ISO = /^\d{4}-\d{2}-\d{2}$/;

function isTask(value: unknown): value is Task {
  if (typeof value !== "object" || value === null) return false;
  const t = value as Record<string, unknown>;
  return (
    Number.isInteger(t.id) &&
    (t.id as number) > 0 &&
    typeof t.title === "string" &&
    (t.status === "open" || t.status === "done") &&
    PRIORITIES.includes(t.priority as never) &&
    (t.due === null || (typeof t.due === "string" && ISO.test(t.due))) &&
    Array.isArray(t.tags) &&
    t.tags.every((tag) => typeof tag === "string") &&
    (t.note === null || typeof t.note === "string") &&
    typeof t.createdAt === "string" &&
    ISO.test(t.createdAt) &&
    (t.completedAt === null || (typeof t.completedAt === "string" && ISO.test(t.completedAt)))
  );
}

function isJournalEntry(value: unknown): value is JournalEntry {
  if (typeof value !== "object" || value === null) return false;
  const e = value as Record<string, unknown>;
  if (e.op === "add") return Number.isInteger(e.id);
  if (e.op === "done") return Array.isArray(e.ids) && e.ids.every((id) => Number.isInteger(id));
  if (e.op === "edit") return Number.isInteger(e.id) && typeof e.before === "object" && e.before !== null;
  return false;
}

/** Reads and checks a store file. A missing file is an empty store; a store from before the journal has an empty one. */
export function readStore(path: string, fs: FsApi): Store {
  let text: string;
  try {
    text = fs.readFileSync(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return emptyStore();
    throw new IoError(`cannot read ${path}: ${(error as Error).message}`);
  }
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new DataError(`${path} is not a valid task store`);
  }
  const invalid = () => new DataError(`${path} is not a valid task store`);
  if (typeof data !== "object" || data === null || Array.isArray(data)) throw invalid();
  const s = data as Record<string, unknown>;
  if (s.version !== 1) {
    if (typeof s.version === "number") throw new DataError(`${path} has unsupported store version ${s.version}`);
    throw invalid();
  }
  if (!Array.isArray(s.tasks) || !s.tasks.every(isTask)) throw invalid();
  const journal = s.journal === undefined ? [] : s.journal;
  if (!Array.isArray(journal) || !journal.every(isJournalEntry)) throw invalid();
  const highest = s.tasks.reduce((max: number, task: Task) => Math.max(max, task.id), 0);
  if (!Number.isInteger(s.nextId) || (s.nextId as number) <= highest) throw invalid();
  return { version: 1, nextId: s.nextId as number, tasks: s.tasks as Task[], journal: journal as JournalEntry[] };
}

/** Writes the store file: two-space JSON and a final newline. */
export function writeStore(path: string, store: Store, fs: FsApi): void {
  const text = `${JSON.stringify(store, null, 2)}\n`;
  try {
    fs.writeFileSync(path, text, "utf8");
  } catch (error) {
    throw new IoError(`cannot save ${path}: ${(error as Error).message}`);
  }
}
