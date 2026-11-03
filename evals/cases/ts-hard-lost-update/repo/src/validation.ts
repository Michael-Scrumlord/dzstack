import { ValidationError } from "./errors.ts";
import { EDITABLE_FIELDS, STATUSES } from "./types.ts";
import type { EditableFields, Status } from "./types.ts";

export const MAX_TITLE = 120;
export const MAX_BODY = 50_000;
export const MAX_TAGS = 10;
const TAG = /^[a-z0-9][a-z0-9-]{0,23}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseTitle(value: unknown): string {
  if (typeof value !== "string") throw new ValidationError("title must be a string");
  const title = value.trim();
  if (title === "") throw new ValidationError("title must not be empty");
  if (title.length > MAX_TITLE) throw new ValidationError(`title is longer than ${MAX_TITLE} characters`);
  return title;
}

function parseBody(value: unknown): string {
  if (typeof value !== "string") throw new ValidationError("body must be a string");
  if (value.length > MAX_BODY) throw new ValidationError(`body is longer than ${MAX_BODY} characters`);
  return value;
}

function parseStatus(value: unknown): Status {
  if (typeof value !== "string" || !STATUSES.includes(value as Status)) {
    throw new ValidationError(`status must be one of ${STATUSES.join(", ")}`);
  }
  return value as Status;
}

/** Tags are lower-cased and de-duplicated, keeping the order they were given in. */
function parseTags(value: unknown): string[] {
  if (!Array.isArray(value)) throw new ValidationError("tags must be an array of strings");
  const tags: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") throw new ValidationError("tags must be an array of strings");
    const tag = item.trim().toLowerCase();
    if (!TAG.test(tag)) throw new ValidationError(`"${item}" is not a valid tag`);
    if (!tags.includes(tag)) tags.push(tag);
  }
  if (tags.length > MAX_TAGS) throw new ValidationError(`a document has at most ${MAX_TAGS} tags`);
  return tags;
}

export function parseCreate(raw: unknown): EditableFields {
  if (!isRecord(raw)) throw new ValidationError("the body must be an object");
  return {
    title: parseTitle(raw.title),
    body: raw.body === undefined ? "" : parseBody(raw.body),
    status: raw.status === undefined ? "draft" : parseStatus(raw.status),
    tags: raw.tags === undefined ? [] : parseTags(raw.tags),
  };
}

/** The fields of an edit: at least one of title, body, status, tags. */
export function parseEditFields(raw: unknown): Partial<EditableFields> {
  if (!isRecord(raw)) throw new ValidationError("fields must be an object");
  const unknown = Object.keys(raw).filter((key) => !(EDITABLE_FIELDS as readonly string[]).includes(key));
  if (unknown.length > 0) throw new ValidationError(`unknown fields: ${unknown.join(", ")}`);
  const fields: Partial<EditableFields> = {};
  if (raw.title !== undefined) fields.title = parseTitle(raw.title);
  if (raw.body !== undefined) fields.body = parseBody(raw.body);
  if (raw.status !== undefined) fields.status = parseStatus(raw.status);
  if (raw.tags !== undefined) fields.tags = parseTags(raw.tags);
  if (Object.keys(fields).length === 0) throw new ValidationError("nothing to change");
  return fields;
}

export function parseBaseVersion(raw: unknown): number {
  if (typeof raw !== "number" || !Number.isInteger(raw) || raw < 0) {
    throw new ValidationError("baseVersion must be a whole number of 0 or more");
  }
  return raw;
}

export function parseEdit(raw: unknown): { baseVersion: number; fields: Partial<EditableFields> } {
  if (!isRecord(raw)) throw new ValidationError("the body must be an object");
  return { baseVersion: parseBaseVersion(raw.baseVersion), fields: parseEditFields(raw.fields) };
}

export function parseShare(raw: unknown): { userId: string; role: "editor" | "viewer" } {
  if (!isRecord(raw)) throw new ValidationError("the body must be an object");
  if (typeof raw.userId !== "string" || raw.userId.trim() === "") throw new ValidationError("userId must be a string");
  if (raw.role !== "editor" && raw.role !== "viewer") throw new ValidationError("role must be editor or viewer");
  return { userId: raw.userId.trim(), role: raw.role };
}

export function parseComment(raw: unknown): { text: string } {
  if (!isRecord(raw)) throw new ValidationError("the body must be an object");
  if (typeof raw.text !== "string" || raw.text.trim() === "") throw new ValidationError("text must not be empty");
  if (raw.text.length > 2000) throw new ValidationError("a comment is at most 2000 characters");
  return { text: raw.text.trim() };
}
