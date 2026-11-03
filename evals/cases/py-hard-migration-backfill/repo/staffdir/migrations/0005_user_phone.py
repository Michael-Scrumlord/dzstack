"""Users get an optional phone number. Empty strings from the old import become NULL."""


def up(conn):
    columns = {row[1] for row in conn.execute("PRAGMA table_info(users)")}
    if "phone" not in columns:
        conn.execute("ALTER TABLE users ADD COLUMN phone TEXT")
    conn.execute("UPDATE users SET phone = NULL WHERE phone IS NOT NULL AND trim(phone) = ''")
