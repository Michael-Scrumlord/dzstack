"""The request handler: (method, path, query, body) in, (status, body) out. No HTTP in here."""
from __future__ import annotations

import sqlite3

from . import audit, reports, teams, users
from .validation import ValidationError, clean_page, clean_user_payload

MAX_PER_PAGE = 100


def _error(status: int, code: str, message: str, **extra) -> tuple[int, dict]:
    return status, {"error": code, "message": message, **extra}


def handle(conn, method: str, path: str, query: dict | None = None, body=None, actor: str = "api") -> tuple[int, dict]:
    """Route one request. Anything unexpected is a 500; known problems are 4xx with {error, message}."""
    query = query or {}
    parts = [part for part in path.split("/") if part]
    try:
        return _route(conn, method.upper(), parts, query, body, actor)
    except ValidationError as error:
        return _error(400, "validation", error.message, field=error.field)
    except sqlite3.IntegrityError as error:
        return _error(409, "conflict", str(error))


def _route(conn, method, parts, query, body, actor):
    if parts == ["users"]:
        if method == "GET":
            return _list_users(conn, query)
        if method == "POST":
            return _create_user(conn, body, actor)
    elif len(parts) == 2 and parts[0] == "users":
        user_id = _id(parts[1])
        if user_id is None:
            return _error(404, "not_found", f"no user {parts[1]}")
        if method == "GET":
            user = users.get(conn, user_id)
            return (200, {"user": users.to_public(user)}) if user else _no_user(user_id)
        if method == "PATCH":
            return _update_user(conn, user_id, body, actor)
        if method == "DELETE":
            return (204, {}) if users.delete(conn, user_id, actor=actor) else _no_user(user_id)
    elif len(parts) == 2 and parts[0] == "teams" and method == "GET":
        return _team(conn, parts[1])
    elif len(parts) == 3 and parts[0] == "teams" and parts[2] == "roster" and method == "GET":
        return _roster(conn, parts[1], query)
    elif parts == ["teams"] and method == "GET":
        return 200, {"teams": teams.list_teams(conn)}
    elif parts == ["directory", "index"] and method == "GET":
        return 200, {"groups": reports.index_by_initial(conn)}
    elif parts == ["audit"] and method == "GET":
        return 200, {"entries": audit.recent(conn, clean_page(query.get("limit"), 20, name="limit", maximum=200))}
    return _error(404, "not_found", f"no route for {method} /{'/'.join(parts)}")


def _id(text) -> int | None:
    try:
        number = int(text)
    except (TypeError, ValueError):
        return None
    return number if number > 0 else None


def _no_user(user_id) -> tuple[int, dict]:
    return _error(404, "not_found", f"no user {user_id}")


def _list_users(conn, query):
    page = clean_page(query.get("page"), 1, name="page")
    per_page = clean_page(query.get("per_page"), 20, name="per_page", maximum=MAX_PER_PAGE)
    sort = query.get("sort") or "name"
    if sort not in users.SORTS:
        raise ValidationError("sort", f"sort must be one of {', '.join(users.SORTS)}")
    team_id = _id(query["team_id"]) if query.get("team_id") else None
    filters = {"q": query.get("q") or None, "team_id": team_id, "status": query.get("status") or None}
    rows = users.list_users(conn, sort=sort, limit=per_page, offset=(page - 1) * per_page, **filters)
    return 200, {
        "users": [users.to_public(row) for row in rows],
        "page": page,
        "per_page": per_page,
        "total": users.count(conn, **filters),
    }


def _create_user(conn, body, actor):
    fields = clean_user_payload(body)
    user = users.create(
        conn,
        full_name=fields["full_name"],
        email=fields["email"],
        team_id=fields.get("team_id"),
        phone=fields.get("phone"),
        actor=actor,
    )
    return 201, {"user": users.to_public(user)}


def _update_user(conn, user_id, body, actor):
    changes = clean_user_payload(body, partial=True)
    user = users.update(conn, user_id, actor=actor, **changes)
    return (200, {"user": users.to_public(user)}) if user else _no_user(user_id)


def _team(conn, raw_id):
    team_id = _id(raw_id)
    team = teams.get_team(conn, team_id) if team_id else None
    if team is None:
        return _error(404, "not_found", f"no team {raw_id}")
    return 200, {"team": {**team, "lead": teams.lead(conn, team["id"])}}


def _roster(conn, raw_id, query):
    team_id = _id(raw_id)
    team = teams.get_team(conn, team_id) if team_id else None
    if team is None:
        return _error(404, "not_found", f"no team {raw_id}")
    include_left = query.get("include_left") in ("1", "true", True)
    return 200, {
        "team": {"id": team["id"], "name": team["name"], "lead": teams.lead(conn, team["id"])},
        "members": teams.roster(conn, team["id"], include_left=include_left),
    }
