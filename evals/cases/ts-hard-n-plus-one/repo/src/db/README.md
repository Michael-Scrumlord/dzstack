# src/db: the database client and its test double

`types.ts` is the `Db` interface that all code in `src/` talks to. The platform team owns this folder: it is vendored from their client package, so changes go there, not here. The production client implements `Db` against Postgres. `fake.ts` is `FakeDb`, the in-memory test double the team uses in every test and in the dev profiler. Code must work through the `Db` interface only; a method that exists on `FakeDb` but not on `Db` does not exist in production.

## What FakeDb counts

Every call to `select`, `selectPage`, `count`, `insert`, `update` and `delete` is one query, however much work it does inside (nested `inSelect` filters, `$or`, ordering). `db.stats` holds:

| field | meaning |
|---|---|
| `queries` | round trips so far |
| `rowsRead` | rows returned by reads (`count` returns one row) |
| `simulatedMs` | `queries * 4 + rowsRead * 0.02`: what the same calls would cost against the real database |

`FakeDb` never sleeps. It adds up what the calls would have cost, so a test that "takes 8 seconds" in production finishes in milliseconds here. `db.log` has one line per query and `db.resetStats()` zeroes both.

## Queries

```ts
db.select("projects", {
  where: { org_id: 1, archived: false },
  orderBy: [{ column: "pinned", dir: "desc" }, { column: "name", nocase: true }, { column: "id" }],
  limit: 20,
  offset: 40,
});
```

- **where** is an object; every key must hold. A bare value means equality, and `null` means "is null". Operators: `eq`, `ne`, `in`, `notIn`, `lt`, `lte`, `gt`, `gte` (never true for null), `isNull`, `ilike`, `inSelect`. Several operators on one column are ANDed. `$or` and `$and` take lists of nested filters; an empty `$or` matches nothing.
- **in-lists** may hold at most 200 values. A longer list throws `TooManyParametersError`, as the production driver does. Split the list or use `inSelect`.
- **inSelect** keeps rows whose column is among the `column` values of a sub-query: `{ id: { inSelect: { table: "project_members", column: "project_id", where: { user_id: 7 } } } }`. It runs inside the same query, has no length limit, and can nest.
- **ilike** matches case-insensitively against the whole value. `%` matches any run of characters, `_` matches any one character, and a backslash escapes the next character, so a literal `%`, `_` or `\` in user input has to be written `\%`, `\_` or `\\`.
- **orderBy** sorts by each entry in turn. Strings compare by code unit (`"B" < "a"`) unless `nocase: true` lowercases both sides first. `false` sorts before `true`. `null` sorts before everything in ascending order and after everything in descending order. Equal rows keep their insertion order here, but Postgres promises no order at all, so always order on something unique last (usually `id`).
- **limit / offset** apply after ordering and `distinctOn`.
- **distinctOn** keeps the first row for each distinct value of a column, after ordering: "the latest row per project" is `orderBy: [{ column: "at", dir: "desc" }]` plus `distinctOn: "project_id"`.
- **selectPage** returns the page and the number of rows that match before `limit`/`offset`, in one query. Use it instead of a `select` plus a `count`.
- Reads return copies; changing a returned row does not change the table.

## In tests

```ts
const db = new FakeDb({ users: [...], projects: [...] }); // rows keep the ids they have
db.load({ tags: [...] });                                 // more rows, not counted as queries
db.resetStats();
await someCall(db);
assert.ok(db.stats.queries <= 8, db.log.join("\n"));
```
