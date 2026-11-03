"""Teams, their leads and their rosters."""
from __future__ import annotations

from . import audit


def create_team(conn, name: str, lead_user_id: int | None = None, *, actor: str = "system") -> dict:
    cursor = conn.execute("INSERT INTO teams (name, lead_user_id) VALUES (?, ?)", (name.strip(), lead_user_id))
    conn.commit()
    team = get_team(conn, cursor.lastrowid)
    audit.record(conn, actor, "team.created", team["id"], team["name"])
    return team


def get_team(conn, team_id: int) -> dict | None:
    row = conn.execute("SELECT id, name, lead_user_id FROM teams WHERE id = ?", (team_id,)).fetchone()
    return dict(row) if row else None


def list_teams(conn) -> list[dict]:
    rows = conn.execute("SELECT id, name, lead_user_id FROM teams ORDER BY name COLLATE NOCASE")
    return [dict(row) for row in rows]


def set_lead(conn, team_id: int, user_id: int | None, *, actor: str = "system") -> None:
    conn.execute("UPDATE teams SET lead_user_id = ? WHERE id = ?", (user_id, team_id))
    conn.commit()
    audit.record(conn, actor, "team.lead_changed", team_id, str(user_id))


def lead(conn, team_id: int) -> dict | None:
    """The team lead as a small summary, or None when the team has none."""
    row = conn.execute(
        "SELECT u.id AS id, u.full_name AS full_name, u.email AS email"
        " FROM teams t JOIN users u ON u.id = t.lead_user_id WHERE t.id = ?",
        (team_id,),
    ).fetchone()
    return dict(row) if row else None


def roster(conn, team_id: int, *, include_left: bool = False) -> list[dict]:
    """Everybody on the team (people who have left only when asked), by name."""
    status_filter = "" if include_left else " AND status <> 'left'"
    rows = conn.execute(
        "SELECT user_id AS id, full_name, email, status FROM team_roster"
        f" WHERE team_id = ?{status_filter} ORDER BY full_name COLLATE NOCASE, user_id",
        (team_id,),
    )
    return [dict(row) for row in rows]


def headcount(conn) -> list[dict]:
    rows = conn.execute(
        "SELECT t.id AS id, t.name AS name, COUNT(r.user_id) AS members"
        " FROM teams t LEFT JOIN team_roster r ON r.team_id = t.id AND r.status <> 'left'"
        " GROUP BY t.id ORDER BY t.name COLLATE NOCASE"
    )
    return [dict(row) for row in rows]
