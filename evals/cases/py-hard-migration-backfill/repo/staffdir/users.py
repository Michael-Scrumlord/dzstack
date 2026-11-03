"""The users table: reads and writes. Rows come back as plain dicts."""
from __future__ import annotations

from . import audit

COLUMNS = "id, full_name, email, team_id, status, phone, created_at"
SORTS = {
    "name": "full_name COLLATE NOCASE, id",
    "email": "email COLLATE NOCASE, id",
    "created": "created_at, id",
}
UPDATABLE = ("full_name", "email", "team_id", "status", "phone")


def _escape_like(text: str) -> str:
    return text.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def _filters(q, team_id, status) -> tuple[str, list]:
    clauses, params = [], []
    if q:
        clauses.append("full_name LIKE ? ESCAPE '\\'")
        params.append(f"%{_escape_like(q)}%")
    if team_id is not None:
        clauses.append("team_id = ?")
        params.append(team_id)
    if status:
        clauses.append("status = ?")
        params.append(status)
    return (" WHERE " + " AND ".join(clauses)) if clauses else "", params


def get(conn, user_id: int) -> dict | None:
    row = conn.execute(f"SELECT {COLUMNS} FROM users WHERE id = ?", (user_id,)).fetchone()
    return dict(row) if row else None


def get_by_email(conn, email: str) -> dict | None:
    row = conn.execute(f"SELECT {COLUMNS} FROM users WHERE email = ?", (email,)).fetchone()
    return dict(row) if row else None


def list_users(conn, *, q=None, team_id=None, status=None, sort="name", limit=50, offset=0) -> list[dict]:
    if sort not in SORTS:
        raise ValueError(f"unknown sort {sort!r}")
    where, params = _filters(q, team_id, status)
    rows = conn.execute(
        f"SELECT {COLUMNS} FROM users{where} ORDER BY {SORTS[sort]} LIMIT ? OFFSET ?",
        [*params, limit, offset],
    )
    return [dict(row) for row in rows]


def count(conn, *, q=None, team_id=None, status=None) -> int:
    where, params = _filters(q, team_id, status)
    return conn.execute(f"SELECT COUNT(*) FROM users{where}", params).fetchone()[0]


def create(conn, *, full_name: str, email: str, team_id=None, phone=None, actor: str = "system") -> dict:
    cursor = conn.execute(
        "INSERT INTO users (full_name, email, team_id, phone) VALUES (?, ?, ?, ?)",
        (full_name, email, team_id, phone),
    )
    conn.commit()
    user = get(conn, cursor.lastrowid)
    audit.record(conn, actor, "user.created", user["id"], user["full_name"])
    return user


def update(conn, user_id: int, *, actor: str = "system", **changes) -> dict | None:
    unknown = set(changes) - set(UPDATABLE)
    if unknown:
        raise ValueError(f"cannot update {', '.join(sorted(unknown))}")
    if not changes:
        return get(conn, user_id)
    assignments = ", ".join(f"{column} = ?" for column in changes)
    cursor = conn.execute(f"UPDATE users SET {assignments} WHERE id = ?", [*changes.values(), user_id])
    conn.commit()
    if cursor.rowcount == 0:
        return None
    user = get(conn, user_id)
    audit.record(conn, actor, "user.updated", user_id, ", ".join(sorted(changes)))
    return user


def delete(conn, user_id: int, *, actor: str = "system") -> bool:
    user = get(conn, user_id)
    if user is None:
        return False
    conn.execute("UPDATE teams SET lead_user_id = NULL WHERE lead_user_id = ?", (user_id,))
    conn.execute("DELETE FROM users WHERE id = ?", (user_id,))
    conn.commit()
    audit.record(conn, actor, "user.deleted", user_id, user["full_name"])
    return True


def to_public(user: dict) -> dict:
    """The shape of a user in API responses."""
    return {
        "id": user["id"],
        "full_name": user["full_name"],
        "email": user["email"],
        "team_id": user["team_id"],
        "status": user["status"],
        "phone": user["phone"],
        "created_at": user["created_at"],
    }
