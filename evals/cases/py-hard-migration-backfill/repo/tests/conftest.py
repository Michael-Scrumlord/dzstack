import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from staffdir import db, migrate, teams, users  # noqa: E402


@pytest.fixture
def conn():
    connection = db.connect(":memory:")
    migrate.run(connection)
    yield connection
    connection.close()


@pytest.fixture
def people(conn):
    """Three users on two teams; Grace leads Platform."""
    ada = users.create(conn, full_name="Ada Lovelace", email="ada@example.com")
    grace = users.create(conn, full_name="Grace Hopper", email="grace@example.com")
    alan = users.create(conn, full_name="Alan Turing", email="alan@example.com")
    platform = teams.create_team(conn, "Platform", lead_user_id=grace["id"])
    research = teams.create_team(conn, "Research")
    users.update(conn, ada["id"], team_id=platform["id"])
    users.update(conn, grace["id"], team_id=platform["id"])
    users.update(conn, alan["id"], team_id=research["id"])
    return {"ada": ada["id"], "grace": grace["id"], "alan": alan["id"], "platform": platform["id"], "research": research["id"]}
