import { invalidQuery } from "./errors.ts";

export const DEFAULT_PER_PAGE = 20;
export const MAX_PER_PAGE = 100;

export type SortKey = "name" | "created" | "updated";

export interface ListQuery {
  page: number;
  perPage: number;
  sort: SortKey;
  order: "asc" | "desc";
  /** Free-text search over project name and key, trimmed; "" means no search. */
  q: string;
  /** Show only projects that carry this tag (by label, any case), trimmed; "" means no filter. */
  tag: string;
  includeArchived: boolean;
}

type Raw = Record<string, string | undefined>;

function positiveInt(raw: string | undefined, name: string, fallback: number): number {
  if (raw === undefined || raw === "") return fallback;
  if (!/^\d+$/.test(raw) || Number(raw) < 1 || !Number.isSafeInteger(Number(raw))) {
    throw invalidQuery(`${name} must be a positive integer`);
  }
  return Number(raw);
}

function oneOf<T extends string>(raw: string | undefined, name: string, allowed: readonly T[], fallback: T): T {
  if (raw === undefined || raw === "") return fallback;
  if (!(allowed as readonly string[]).includes(raw)) throw invalidQuery(`${name} must be one of ${allowed.join(", ")}`);
  return raw as T;
}

function flag(raw: string | undefined, name: string): boolean {
  if (raw === undefined || raw === "") return false;
  if (raw === "true" || raw === "1") return true;
  if (raw === "false" || raw === "0") return false;
  throw invalidQuery(`${name} must be true or false`);
}

export function parseListQuery(query: Raw = {}): ListQuery {
  return {
    page: positiveInt(query.page, "page", 1),
    perPage: Math.min(positiveInt(query.perPage, "perPage", DEFAULT_PER_PAGE), MAX_PER_PAGE),
    sort: oneOf(query.sort, "sort", ["name", "created", "updated"] as const, "name"),
    order: oneOf(query.order, "order", ["asc", "desc"] as const, "asc"),
    q: (query.q ?? "").trim(),
    tag: (query.tag ?? "").trim(),
    includeArchived: flag(query.includeArchived, "includeArchived"),
  };
}

export function parseId(raw: string, what: string): number {
  if (!/^\d+$/.test(raw)) throw invalidQuery(`${what} must be a number`);
  return Number(raw);
}
