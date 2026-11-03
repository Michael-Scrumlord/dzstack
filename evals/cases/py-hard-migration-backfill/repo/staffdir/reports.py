"""Reports the directory pages are built from."""
from __future__ import annotations

from . import users


def index_by_initial(conn) -> dict[str, list[dict]]:
    """The A-Z index: users grouped by the first letter of their last name, in name order.

    Anything that does not start with a letter goes under "#".
    """
    groups: dict[str, list[dict]] = {}
    for user in users.list_users(conn, sort="name", limit=1_000_000):
        words = (user["full_name"] or "").split()
        initial = words[-1][0].upper() if words else "#"
        if not initial.isalpha():
            initial = "#"
        groups.setdefault(initial, []).append(users.to_public(user))
    return dict(sorted(groups.items(), key=lambda item: (item[0] == "#", item[0])))


def status_summary(conn) -> dict[str, int]:
    rows = conn.execute("SELECT status, COUNT(*) AS n FROM users GROUP BY status")
    counts = {row["status"]: row["n"] for row in rows}
    return {status: counts.get(status, 0) for status in ("active", "suspended", "left")}


def team_sizes(conn) -> list[tuple[str, int]]:
    rows = conn.execute(
        "SELECT COALESCE(t.name, '(no team)') AS team, COUNT(*) AS n"
        " FROM users u LEFT JOIN teams t ON t.id = u.team_id"
        " WHERE u.status <> 'left' GROUP BY team ORDER BY n DESC, team COLLATE NOCASE"
    )
    return [(row["team"], row["n"]) for row in rows]
