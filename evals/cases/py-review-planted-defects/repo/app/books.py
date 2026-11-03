"""Books table."""


def add_book(conn, title, author):
    cur = conn.execute("INSERT INTO books (title, author) VALUES (?, ?)", (title, author))
    conn.commit()
    return cur.lastrowid


def get_book(conn, book_id):
    return conn.execute("SELECT id, title, author FROM books WHERE id = ?", (book_id,)).fetchone()


def find_books(conn, text):
    """Books whose title contains `text`, ignoring case."""
    return conn.execute(
        "SELECT id, title, author FROM books WHERE title LIKE ? ORDER BY title",
        (f"%{text}%",),
    ).fetchall()
