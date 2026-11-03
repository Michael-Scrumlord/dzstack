"""Users get a status: active, suspended or left."""


def up(conn):
    columns = {row[1] for row in conn.execute("PRAGMA table_info(users)")}
    if "status" not in columns:
        conn.execute("ALTER TABLE users ADD COLUMN status TEXT NOT NULL DEFAULT 'active'")
    # Touch only the rows that still need it, so a second run changes nothing.
    conn.execute("UPDATE users SET status = 'active' WHERE status NOT IN ('active', 'suspended', 'left')")
