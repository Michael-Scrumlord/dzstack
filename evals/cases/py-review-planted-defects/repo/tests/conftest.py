from datetime import date

import pytest

from app import books, members
from app.db import connect


@pytest.fixture
def conn():
    return connect()


@pytest.fixture
def today():
    return date(2026, 3, 1)


@pytest.fixture
def seeded(conn):
    """A member and ten books."""
    member_id = members.add_member(conn, "Ada Byron", "ada@example.org")
    book_ids = [books.add_book(conn, f"Book {n}", "Some Author") for n in range(1, 11)]
    return member_id, book_ids
