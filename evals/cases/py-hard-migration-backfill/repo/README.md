# staffdir

The company staff directory: users, teams and an audit trail, on SQLite (standard library only).

```
python -m staffdir migrate          # create or update ./staffdir.db (or $STAFFDIR_DB, or --db PATH)
python -m staffdir users add --name "Ada Lovelace" --email ada@example.com
python -m staffdir users list --q ada
python -m pytest -q                 # the tests
```

## Layout

| Module | What it does |
|---|---|
| `staffdir/migrate.py`, `staffdir/migrations/` | the migration runner and the migrations; the rules are in `docs/migrations.md` |
| `staffdir/db.py` | opening the database |
| `staffdir/users.py`, `teams.py`, `audit.py` | the tables: reads and writes |
| `staffdir/validation.py` | input checks |
| `staffdir/api.py` | `handle(conn, method, path, query, body)` returns `(status, body)` |
| `staffdir/exports.py`, `reports.py`, `notifications.py` | the CSV export, the A-Z index and counts, the messages |
| `staffdir/cli.py` | the command line |

## API

| Request | Result |
|---|---|
| `GET /users` (`q`, `team_id`, `status`, `sort=name\|email\|created`, `page`, `per_page`) | 200 `{users, page, per_page, total}` |
| `POST /users` | 201 `{user}` |
| `GET /users/<id>`, `PATCH /users/<id>` | 200 `{user}` |
| `DELETE /users/<id>` | 204 |
| `GET /teams`, `GET /teams/<id>`, `GET /teams/<id>/roster` | 200 |
| `GET /directory/index` | 200 `{groups}` |
| `GET /audit` | 200 `{entries}` |

Errors are `{error, message}` with 400 (validation, plus `field`), 404 or 409 (a duplicate email).

## Names

How a user's name is stored and read is in `docs/names.md`. Schema changes follow `docs/migrations.md`.
