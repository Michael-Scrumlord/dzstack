"""The messages the directory sends. Nothing is sent from here: callers get the message back."""
from __future__ import annotations

from . import teams, users


def welcome_message(conn, user_id: int) -> dict:
    user = users.get(conn, user_id)
    if user is None:
        raise LookupError(f"no user {user_id}")
    first = (user["full_name"] or "").split(" ")[0] or "there"
    body = (
        f"Hi {first},\n\n"
        "Your account in the staff directory is ready. Sign in with this email address "
        "and check that your team and phone number are right.\n"
    )
    return {"to": user["email"], "subject": "Welcome to the staff directory", "body": body}


def deactivation_notice(conn, user_id: int) -> dict | None:
    """Tell the team lead that somebody on the team left. None when the user has no team lead."""
    user = users.get(conn, user_id)
    if user is None or user["team_id"] is None:
        return None
    lead = teams.lead(conn, user["team_id"])
    if lead is None:
        return None
    name = user["full_name"] or user["email"]
    body = f"{name} ({user['email']}) is no longer active in the directory. Please update the team plan.\n"
    return {"to": lead["email"], "subject": f"{name} has left your team", "body": body}
