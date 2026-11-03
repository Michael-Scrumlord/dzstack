// FakeDb: the in-memory test double the team uses in place of the production client.
// It counts round trips and rows so tests can assert on them. It never sleeps: the
// latency is simulated by counting (see `stats.simulatedMs`).

import type { Condition, Db, Filter, OrderBy, SelectOptions, SubSelect } from "./types.ts";
import type { TableName, Tables } from "./schema.ts";

/** Simulated cost of one round trip, in milliseconds. */
export const QUERY_MS = 4;
/** Simulated cost of each row a query returns, in milliseconds. */
export const ROW_MS = 0.02;
/** Longest in-list the production driver accepts (its bind-parameter limit). */
export const MAX_IN_LIST = 200;

export class TooManyParametersError extends Error {
  constructor(count: number) {
    super(`in-list has ${count} values; the limit is ${MAX_IN_LIST}`);
    this.name = "TooManyParametersError";
  }
}

export class UnknownColumnError extends Error {
  constructor(table: string, column: string) {
    super(`table ${table} has no column ${column}`);
    this.name = "UnknownColumnError";
  }
}

type AnyRow = Record<string, unknown>;
type Data = { [K in TableName]: Tables[K][] };

const EMPTY_TABLES: TableName[] = [
  "users",
  "sessions",
  "projects",
  "project_members",
  "tags",
  "project_tags",
  "activity",
  "audit_log",
];

const tick = () => Promise.resolve();

export class FakeDb implements Db {
  readonly tables: Data;
  readonly stats = {
    queries: 0,
    rowsRead: 0,
    get simulatedMs(): number {
      return this.queries * QUERY_MS + this.rowsRead * ROW_MS;
    },
  };
  /** One line per query, newest last. Handy when a test fails on the query count. */
  readonly log: string[] = [];
  private nextId = new Map<string, number>();

  constructor(data: Partial<Data> = {}) {
    this.tables = Object.fromEntries(EMPTY_TABLES.map((t) => [t, []])) as unknown as Data;
    this.load(data);
  }

  /** Put rows in without counting a query (test setup). Rows keep the ids they have. */
  load(data: Partial<Data>): void {
    for (const name of EMPTY_TABLES) {
      for (const row of (data[name] ?? []) as AnyRow[]) {
        (this.tables[name] as AnyRow[]).push({ ...row });
        this.nextId.set(name, Math.max(this.nextId.get(name) ?? 1, (row.id as number) + 1));
      }
    }
  }

  resetStats(): void {
    this.stats.queries = 0;
    this.stats.rowsRead = 0;
    this.log.length = 0;
  }

  async select<K extends TableName>(table: K, options: SelectOptions = {}): Promise<Tables[K][]> {
    this.begin("select", table, options);
    await tick();
    const { rows } = this.run(table, options);
    this.stats.rowsRead += rows.length;
    return rows as Tables[K][];
  }

  async selectPage<K extends TableName>(
    table: K,
    options: SelectOptions & { limit: number },
  ): Promise<{ rows: Tables[K][]; total: number }> {
    this.begin("selectPage", table, options);
    await tick();
    const { rows, total } = this.run(table, options);
    this.stats.rowsRead += rows.length;
    return { rows: rows as Tables[K][], total };
  }

  async count(table: TableName, where: Filter = {}): Promise<number> {
    this.begin("count", table, { where });
    await tick();
    this.stats.rowsRead += 1;
    return (this.tables[table] as AnyRow[]).filter(this.compile(table, where)).length;
  }

  async insert<K extends TableName>(table: K, row: Omit<Tables[K], "id">): Promise<Tables[K]> {
    this.begin("insert", table, row);
    await tick();
    const id = this.nextId.get(table) ?? 1;
    this.nextId.set(table, id + 1);
    const stored = { id, ...row } as AnyRow;
    (this.tables[table] as AnyRow[]).push(stored);
    return { ...stored } as unknown as Tables[K];
  }

  async update<K extends TableName>(table: K, where: Filter, patch: Partial<Omit<Tables[K], "id">>): Promise<number> {
    this.begin("update", table, { where, patch });
    await tick();
    const hits = (this.tables[table] as AnyRow[]).filter(this.compile(table, where));
    for (const row of hits) Object.assign(row, patch);
    return hits.length;
  }

  async delete(table: TableName, where: Filter): Promise<number> {
    this.begin("delete", table, { where });
    await tick();
    const rows = this.tables[table] as AnyRow[];
    const test = this.compile(table, where);
    const keep = rows.filter((r) => !test(r));
    const removed = rows.length - keep.length;
    rows.splice(0, rows.length, ...keep);
    return removed;
  }

  // ---- internals ----

  private begin(op: string, table: string, detail: unknown): void {
    this.stats.queries++;
    if (this.log.length < 5000) this.log.push(`${op} ${table} ${JSON.stringify(detail)}`.slice(0, 300));
  }

  private run(table: TableName, options: SelectOptions): { rows: AnyRow[]; total: number } {
    let rows = (this.tables[table] as AnyRow[]).filter(this.compile(table, options.where ?? {}));
    if (options.orderBy?.length) {
      for (const o of options.orderBy) this.assertColumn(table, o.column);
      rows = [...rows].sort(comparator(options.orderBy));
    }
    if (options.distinctOn) {
      this.assertColumn(table, options.distinctOn);
      const seen = new Set<unknown>();
      rows = rows.filter((r) => {
        const key = r[options.distinctOn as string];
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }
    const total = rows.length;
    const start = options.offset ?? 0;
    rows = rows.slice(start, options.limit === undefined ? undefined : start + options.limit);
    return { rows: rows.map((r) => ({ ...r })), total };
  }

  private assertColumn(table: TableName, column: string): void {
    const sample = (this.tables[table] as AnyRow[])[0];
    if (sample && !(column in sample)) throw new UnknownColumnError(table, column);
  }

  private compile(table: TableName, filter: Filter): (row: AnyRow) => boolean {
    const tests: Array<(row: AnyRow) => boolean> = [];
    for (const [key, cond] of Object.entries(filter)) {
      if (cond === undefined) continue;
      if (key === "$or") {
        const subs = (cond as Filter[]).map((f) => this.compile(table, f));
        tests.push((row) => subs.some((t) => t(row)));
      } else if (key === "$and") {
        const subs = (cond as Filter[]).map((f) => this.compile(table, f));
        tests.push((row) => subs.every((t) => t(row)));
      } else {
        this.assertColumn(table, key);
        tests.push(this.condition(key, cond as Condition));
      }
    }
    return (row) => tests.every((t) => t(row));
  }

  private condition(key: string, cond: Condition): (row: AnyRow) => boolean {
    if (cond === null || typeof cond !== "object") return (row) => row[key] === cond;
    const tests: Array<(row: AnyRow) => boolean> = [];
    for (const [op, arg] of Object.entries(cond)) {
      switch (op) {
        case "eq":
          tests.push((row) => row[key] === arg);
          break;
        case "ne":
          tests.push((row) => row[key] !== arg);
          break;
        case "in": {
          const list = arg as unknown[];
          if (list.length > MAX_IN_LIST) throw new TooManyParametersError(list.length);
          const set = new Set(list);
          tests.push((row) => set.has(row[key]));
          break;
        }
        case "notIn": {
          const list = arg as unknown[];
          if (list.length > MAX_IN_LIST) throw new TooManyParametersError(list.length);
          const set = new Set(list);
          tests.push((row) => !set.has(row[key]));
          break;
        }
        case "lt":
          tests.push((row) => row[key] !== null && (row[key] as number) < (arg as number));
          break;
        case "lte":
          tests.push((row) => row[key] !== null && (row[key] as number) <= (arg as number));
          break;
        case "gt":
          tests.push((row) => row[key] !== null && (row[key] as number) > (arg as number));
          break;
        case "gte":
          tests.push((row) => row[key] !== null && (row[key] as number) >= (arg as number));
          break;
        case "isNull":
          tests.push((row) => (row[key] === null) === arg);
          break;
        case "ilike": {
          const re = likeToRegExp(String(arg));
          tests.push((row) => typeof row[key] === "string" && re.test(row[key] as string));
          break;
        }
        case "inSelect": {
          const sub = arg as SubSelect;
          const inner = this.compile(sub.table, sub.where ?? {});
          const values = new Set((this.tables[sub.table] as AnyRow[]).filter(inner).map((r) => r[sub.column]));
          tests.push((row) => values.has(row[key]));
          break;
        }
        default:
          throw new Error(`unknown operator ${op}`);
      }
    }
    return (row) => tests.every((t) => t(row));
  }
}

function likeToRegExp(pattern: string): RegExp {
  let out = "";
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i];
    if (c === "\\" && i + 1 < pattern.length) out += escapeRegExp(pattern[++i]);
    else if (c === "%") out += ".*";
    else if (c === "_") out += ".";
    else out += escapeRegExp(c);
  }
  return new RegExp(`^${out}$`, "is");
}

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function compareValues(a: unknown, b: unknown, nocase: boolean): number {
  if (a === b) return 0;
  if (a === null || a === undefined) return -1;
  if (b === null || b === undefined) return 1;
  if (typeof a === "string" && typeof b === "string") {
    if (nocase) {
      a = a.toLowerCase();
      b = b.toLowerCase();
    }
    return (a as string) < (b as string) ? -1 : (a as string) > (b as string) ? 1 : 0;
  }
  return Number(a) - Number(b);
}

function comparator(order: OrderBy[]): (a: AnyRow, b: AnyRow) => number {
  return (a, b) => {
    for (const o of order) {
      const c = compareValues(a[o.column], b[o.column], o.nocase ?? false);
      if (c !== 0) return o.dir === "desc" ? -c : c;
    }
    return 0;
  };
}
