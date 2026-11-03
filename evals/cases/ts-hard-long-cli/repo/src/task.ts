export type Priority = "high" | "normal" | "low";
export const PRIORITIES: readonly Priority[] = ["high", "normal", "low"];

export interface Task {
  id: number;
  title: string;
  status: "open" | "done";
  priority: Priority;
  /** YYYY-MM-DD, or null. */
  due: string | null;
  tags: string[];
  note: string | null;
  /** YYYY-MM-DD */
  createdAt: string;
  /** YYYY-MM-DD, or null while the task is open. */
  completedAt: string | null;
}

/** One change that `undo` can take back. Newest entry last. */
export type JournalEntry =
  | { op: "add"; id: number }
  | { op: "done"; ids: number[] }
  | { op: "edit"; id: number; before: Partial<Pick<Task, "title" | "due" | "priority" | "note" | "tags">> };

export interface Store {
  version: 1;
  nextId: number;
  tasks: Task[];
  journal: JournalEntry[];
}

export function emptyStore(): Store {
  return { version: 1, nextId: 1, tasks: [], journal: [] };
}

export function findTask(store: Store, id: number): Task | undefined {
  return store.tasks.find((task) => task.id === id);
}

/** Highest priority first: used wherever tasks are shown by urgency. */
export function priorityRank(priority: Priority): number {
  return PRIORITIES.indexOf(priority);
}
