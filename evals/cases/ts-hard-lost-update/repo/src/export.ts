import { ValidationError } from "./errors.ts";
import type { DocumentRecord } from "./types.ts";

export type ExportFormat = "md" | "txt";

export function parseFormat(value: string | undefined): ExportFormat {
  if (value === undefined || value === "md") return "md";
  if (value === "txt") return "txt";
  throw new ValidationError("format must be md or txt");
}

function isoDate(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Markdown with a small front matter block. */
export function toMarkdown(doc: DocumentRecord): string {
  const front = [
    "---",
    `title: ${JSON.stringify(doc.title)}`,
    `status: ${doc.status}`,
    `tags: [${doc.tags.join(", ")}]`,
    `version: ${doc.version}`,
    `updated: ${isoDate(doc.updatedAt)}`,
    "---",
  ];
  return `${front.join("\n")}\n\n# ${doc.title}\n\n${doc.body.trimEnd()}\n`;
}

/** Plain text: the title underlined, then the body with Markdown heading markers removed. */
export function toPlainText(doc: DocumentRecord): string {
  const body = doc.body
    .split("\n")
    .map((line) => line.replace(/^#{1,6}\s+/, ""))
    .join("\n")
    .trimEnd();
  return `${doc.title}\n${"=".repeat(doc.title.length)}\n\n${body}\n`;
}

export function exportDocument(doc: DocumentRecord, format: ExportFormat): string {
  return format === "md" ? toMarkdown(doc) : toPlainText(doc);
}
