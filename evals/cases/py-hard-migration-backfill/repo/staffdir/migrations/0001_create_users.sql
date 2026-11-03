-- The people in the directory. full_name is free text typed by whoever created the row.
CREATE TABLE users (
    id INTEGER PRIMARY KEY,
    full_name TEXT,
    email TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

CREATE INDEX users_full_name ON users (full_name COLLATE NOCASE);
