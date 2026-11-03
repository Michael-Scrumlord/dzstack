"""Request handlers. `handle` maps (method, path) to a data-access call and returns (status, body)."""
import re

from app import books, loans, members


def handle(conn, method, path, query, body, today):
    try:
        if method == "GET" and path == "/books":
            found = books.find_books(conn, query.get("q", ""))
            return 200, {"books": [dict(r) for r in found]}
        if method == "POST" and path == "/books":
            book_id = books.add_book(conn, body["title"], body["author"])
            return 201, {"id": book_id}
        if method == "POST" and path == "/loans":
            loan_id = loans.checkout(conn, int(body["member_id"]), int(body["book_id"]), today)
            return 201, {"loan_id": loan_id}
        match = re.fullmatch(r"/loans/(\d+)/return", path)
        if method == "POST" and match:
            loans.return_book(conn, int(match.group(1)), today)
            return 200, {"returned": True}
        match = re.fullmatch(r"/members/(\d+)/loans", path)
        if method == "GET" and match:
            rows = loans.active_loans(conn, int(match.group(1)))
            return 200, {"loans": [dict(r) for r in rows]}
    except loans.LoanError as exc:
        return 409, {"error": str(exc)}
    except (KeyError, ValueError):
        return 400, {"error": "bad request"}
    return 404, {"error": "not found"}
