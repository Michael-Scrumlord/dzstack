"""The audit trail: one row per change somebody might ask about later."""
from __future__ import annotations


def record(conn, actor: str, action: str, subject_id: int | None, detail: str | None = None) -> None:
    conn.execute(
        "INSERT INTO audit_log (actor, action, subject_id, detail) VALUES (?, ?, ?, ?)",
        (actor, action, subject_id, detail),
    )
    conn.commit()


def recent(conn, limit: int = 20) -> list[dict]:
    rows = conn.execute(
        "SELECT id, at, actor, action, subject_id, detail FROM audit_log ORDER BY id DESC LIMIT ?", (limit,)
    )
    return [dict(row) for row in rows]


def for_subject(conn, subject_id: int) -> list[dict]:
    rows = conn.execute(
        "SELECT id, at, actor, action, subject_id, detail FROM audit_log WHERE subject_id = ? ORDER BY id",
        (subject_id,),
    )
    return [dict(row) for row in rows]
