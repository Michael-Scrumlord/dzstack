// The database client's interface. The platform team owns it; the production client
// (src/db/pg.ts in their package) and the FakeDb used in tests both implement it.
// See src/db/README.md for the query language.

import type { TableName, Tables } from "./schema.ts";

export type Scalar = string | number | boolean | null;

export interface Operators {
  eq?: Scalar;
  ne?: Scalar;
  in?: Scalar[];
  notIn?: Scalar[];
  lt?: Scalar;
  lte?: Scalar;
  gt?: Scalar;
  gte?: Scalar;
  isNull?: boolean;
  /** Case-insensitive pattern match: % is any run of characters, _ is one character, \ escapes. */
  ilike?: string;
  /** The column's value is among the `column` values of the rows `table` returns for `where`. */
  inSelect?: SubSelect;
}

export type Condition = Scalar | Operators;

export interface SubSelect {
  table: TableName;
  column: string;
  where?: Filter;
}

/** Every key must hold (AND). `$or` and `$and` take lists of nested filters. */
export interface Filter {
  $or?: Filter[];
  $and?: Filter[];
  [column: string]: Condition | Filter[] | undefined;
}

export interface OrderBy {
  column: string;
  dir?: "asc" | "desc";
  /** Compare strings case-insensitively. */
  nocase?: boolean;
}

export interface SelectOptions {
  where?: Filter;
  orderBy?: OrderBy[];
  limit?: number;
  offset?: number;
  /** After ordering, keep only the first row for each distinct value of this column. */
  distinctOn?: string;
}

export interface Db {
  select<K extends TableName>(table: K, options?: SelectOptions): Promise<Tables[K][]>;
  /** One round trip that returns a page of rows and the total number of rows that match. */
  selectPage<K extends TableName>(
    table: K,
    options: SelectOptions & { limit: number },
  ): Promise<{ rows: Tables[K][]; total: number }>;
  count(table: TableName, where?: Filter): Promise<number>;
  insert<K extends TableName>(table: K, row: Omit<Tables[K], "id">): Promise<Tables[K]>;
  update<K extends TableName>(table: K, where: Filter, patch: Partial<Omit<Tables[K], "id">>): Promise<number>;
  delete(table: TableName, where: Filter): Promise<number>;
}
