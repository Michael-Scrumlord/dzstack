import { padEnd, padStart, truncate } from "./text.ts";
import { priorityRank } from "./task.ts";
import type { Task } from "./task.ts";

const TITLE_WIDTH = 40;

/** The table `list` prints: id, priority, due date and title, one task per line. */
export function formatTable(tasks: Task[]): string {
  if (tasks.length === 0) return "No tasks.\n";
  const idWidth = Math.max(2, ...tasks.map((task) => String(task.id).length));
  const header = `${padStart("ID", idWidth)}  ${padEnd("PRI", 6)}  ${padEnd("DUE", 10)}  TITLE`;
  const lines = tasks.map((task) => {
    const mark = task.status === "done" ? " (done)" : "";
    return [
      padStart(String(task.id), idWidth),
      padEnd(task.priority, 6),
      padEnd(task.due ?? "-", 10),
      truncate(task.title, TITLE_WIDTH) + mark,
    ].join("  ");
  });
  return `${[header, ...lines].join("\n")}\n`;
}

/** Open tasks first by urgency: priority, then due date (no date last), then id. */
export function listOrder(tasks: Task[]): Task[] {
  return [...tasks].sort(
    (a, b) =>
      priorityRank(a.priority) - priorityRank(b.priority) ||
      (a.due ?? "9999-99-99").localeCompare(b.due ?? "9999-99-99") ||
      a.id - b.id,
  );
}
