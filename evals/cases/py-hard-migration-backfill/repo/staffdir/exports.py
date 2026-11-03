"""CSV exports for the people who still want a spreadsheet."""
from __future__ import annotations

import csv
import io

COLUMNS = ["id", "full_name", "email", "team", "status"]


def users_csv(conn) -> str:
    """Every user, one row each, ordered by name. Line endings are \\n."""
    rows = conn.execute(
        "SELECT u.id AS id, u.full_name AS full_name, u.email AS email, t.name AS team, u.status AS status"
        " FROM users u LEFT JOIN teams t ON t.id = u.team_id"
        " ORDER BY u.full_name COLLATE NOCASE, u.id"
    )
    out = io.StringIO()
    writer = csv.writer(out, lineterminator="\n")
    writer.writerow(COLUMNS)
    for row in rows:
        writer.writerow(["" if row[column] is None else row[column] for column in COLUMNS])
    return out.getvalue()
