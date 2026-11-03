from datetime import date

import pytest

from app import loans
from app.loans import LoanError


def test_checkout_sets_the_due_date(conn, seeded, today):
    member_id, book_ids = seeded
    loan_id = loans.checkout(conn, member_id, book_ids[0], today)
    row = conn.execute("SELECT due_on FROM loans WHERE id = ?", (loan_id,)).fetchone()
    assert row["due_on"] == "2026-03-15"


def test_a_book_goes_to_one_member_at_a_time(conn, seeded, today):
    member_id, book_ids = seeded
    loans.checkout(conn, member_id, book_ids[0], today)
    with pytest.raises(LoanError):
        loans.checkout(conn, member_id, book_ids[0], today)


def test_the_sixth_book_is_refused(conn, seeded, today):
    member_id, book_ids = seeded
    for book_id in book_ids[:5]:
        loans.checkout(conn, member_id, book_id, today)
    with pytest.raises(LoanError):
        loans.checkout(conn, member_id, book_ids[5], today)


def test_returning_frees_the_book(conn, seeded, today):
    member_id, book_ids = seeded
    loan_id = loans.checkout(conn, member_id, book_ids[0], today)
    loans.return_book(conn, loan_id, date(2026, 3, 5))
    assert loans.is_available(conn, book_ids[0])
    with pytest.raises(LoanError):
        loans.return_book(conn, loan_id, date(2026, 3, 6))
