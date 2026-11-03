from app import books


def test_find_books_ignores_case(conn):
    books.add_book(conn, "The Dispossessed", "Ursula K. Le Guin")
    books.add_book(conn, "Dune", "Frank Herbert")
    assert [b["title"] for b in books.find_books(conn, "DISPO")] == ["The Dispossessed"]


def test_find_books_treats_quotes_as_text(conn):
    books.add_book(conn, "Ender's Game", "Orson Scott Card")
    assert len(books.find_books(conn, "'")) == 1
