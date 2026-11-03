# Migrations

How the database schema changes. The runner is `staffdir/migrate.py`; `python -m staffdir migrate` applies whatever is pending.

## Files

- A migration is `staffdir/migrations/NNNN_slug.sql` or `NNNN_slug.py`. `NNNN` is a four-digit version: the next migration is one higher than the highest in the folder. A migration that has been released is never edited; the fix is a new migration.
- A `.sql` file holds plain statements (triggers are fine). A `.py` file defines `up(conn)`.
- The runner runs each migration inside one transaction (`BEGIN IMMEDIATE` ... `COMMIT`) together with its row in `schema_migrations`. If the migration raises, everything it did is rolled back. So a migration never issues `BEGIN`, `COMMIT` or `ROLLBACK`, and a Python migration uses `conn.execute`, never `conn.executescript` (that commits the runner's transaction first).
- A migration is self-contained: it does not import from `staffdir`. The application keeps changing; a migration has to keep doing what it did on the day it was written. Copy what you need into the file.

## Rules

### Re-runnable

Every migration can be run twice against the same database. We restore databases from backups, replay a migration after a half-finished rollout, and the rollout below runs `migrate` once more at the end. The second run must neither fail nor change anything the first run, or somebody since, already set.

- `ALTER TABLE ... ADD COLUMN` has no `IF NOT EXISTS`: look at `PRAGMA table_info(<table>)` first (see `0003_user_status.py`).
- Use `CREATE ... IF NOT EXISTS`, and `DROP ... IF EXISTS` before re-creating a view or a trigger.
- A backfill touches only the rows that still need it. A value somebody corrected by hand after the first run stays as it is.

To check this, delete the migration's row from `schema_migrations` and run `migrate` again.

### No data loss

A migration never throws information away: no dropped columns, no rewritten values, no rows lost, no other table touched. A backfill reads the old column and writes the new ones; it does not change the old one. Anything a backfill cannot interpret is copied over as it is, not skipped.

### Changing a column's shape: expand, then contract

Splitting or renaming a column takes two releases.

1. **Expand** (this kind of change, in one release): a migration adds the new columns and backfills them. The old column stays. The release reads and writes the new columns and keeps the old column correct on every write.
2. **Contract** (a later release, once nothing reads the old column any more): a migration drops the old column. Never in the same release as the expand.

New columns are nullable. `NULL` means "not filled in yet"; a value that is simply absent is stored as `''`, not `NULL`. After a backfill no row has `NULL` in a column the backfill is responsible for.

### Views, triggers and indexes

A view, trigger or index that mentions the old column is rebuilt on the new columns by the same migration (`DROP ... IF EXISTS`, then `CREATE`), because SQLite cannot alter them. Indexes the new release relies on for sorting and searching are created in that migration too.

### Rollout

Deploys overlap: for a while the old and the new release run against the same database. The old release only knows the old shape: it reads and writes the old column and nothing else.

1. The expand migration runs, then the new release rolls out.
2. Rows the old release inserts or changes in the meantime have `NULL` in the new columns. The new release must still read them correctly: where both new columns of a row are `NULL` it works the values out from the old column in memory, with the same rules the backfill uses. It does not write them back while reading.
3. When no old release is running any more, `migrate` runs once more: the migration fills in those rows (and only those).

## Testing a migration

Build a database at the previous schema (run the older migrations only), insert the awkward rows, run the migration, check the result, run it again and check nothing moved. `tests/test_migrate.py` shows how to run the runner against a folder of your own.
