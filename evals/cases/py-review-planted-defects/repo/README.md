# libdesk

The lending desk of a small community library: books, members and loans in SQLite.

- `app/db.py`: the schema and `connect()`. The server opens **one connection at startup** and hands it to every request handler, so all requests share it.
- `app/books.py`, `app/members.py`, `app/loans.py`: data access, one module per table.
- `app/routes.py`: `handle(conn, method, path, query, body, today)` returns `(status, json_body)`. The web layer only calls this function.

## Rules the desk works by

- A loan lasts 14 days (`LOAN_DAYS`).
- A member may have at most 5 books out at once (`MAX_LOANS`).
- A book can be on loan to one member at a time.
- Handlers commit their own writes; a refused request must leave the database as it was.

## Tests

```
python3 -m pytest
```
