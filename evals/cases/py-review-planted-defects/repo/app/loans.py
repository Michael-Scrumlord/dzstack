"""Loans: checking books out and back in."""
from datetime import timedelta

LOAN_DAYS = 14
MAX_LOANS = 5


class LoanError(Exception):
    """A checkout or return the desk has to refuse."""


def is_available(conn, book_id):
    row = conn.execute(
        "SELECT 1 FROM loans WHERE book_id = ? AND returned_on IS NULL", (book_id,)
    ).fetchone()
    return row is None


def active_loans(conn, member_id):
    return conn.execute(
        "SELECT id, book_id, loaned_on, due_on FROM loans "
        "WHERE member_id = ? AND returned_on IS NULL ORDER BY due_on",
        (member_id,),
    ).fetchall()


def checkout(conn, member_id, book_id, today):
    if len(active_loans(conn, member_id)) >= MAX_LOANS:
        raise LoanError(f"member {member_id} already has {MAX_LOANS} books out")
    if not is_available(conn, book_id):
        raise LoanError(f"book {book_id} is already on loan")
    due = today + timedelta(days=LOAN_DAYS)
    cur = conn.execute(
        "INSERT INTO loans (book_id, member_id, loaned_on, due_on) VALUES (?, ?, ?, ?)",
        (book_id, member_id, today.isoformat(), due.isoformat()),
    )
    conn.commit()
    return cur.lastrowid


def return_book(conn, loan_id, today):
    row = conn.execute(
        "SELECT id FROM loans WHERE id = ? AND returned_on IS NULL", (loan_id,)
    ).fetchone()
    if row is None:
        raise LoanError(f"loan {loan_id} is not open")
    conn.execute("UPDATE loans SET returned_on = ? WHERE id = ?", (today.isoformat(), loan_id))
    conn.commit()
