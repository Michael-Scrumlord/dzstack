"""Members table."""


def add_member(conn, name, email):
    cur = conn.execute("INSERT INTO members (name, email) VALUES (?, ?)", (name, email))
    conn.commit()
    return cur.lastrowid


def get_member(conn, member_id):
    return conn.execute("SELECT id, name, email FROM members WHERE id = ?", (member_id,)).fetchone()
