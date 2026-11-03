import pytest

from staffdir import notifications, users


def test_welcome_greets_by_first_name(conn, people):
    message = notifications.welcome_message(conn, people["ada"])
    assert message["to"] == "ada@example.com"
    assert message["body"].startswith("Hi Ada,\n")


def test_welcome_for_an_unknown_user_is_an_error(conn):
    with pytest.raises(LookupError):
        notifications.welcome_message(conn, 42)


def test_the_team_lead_hears_when_somebody_leaves(conn, people):
    notice = notifications.deactivation_notice(conn, people["ada"])
    assert notice["to"] == "grace@example.com"
    assert notice["subject"] == "Ada Lovelace has left your team"
    assert "ada@example.com" in notice["body"]


def test_no_notice_without_a_team_or_a_lead(conn, people):
    assert notifications.deactivation_notice(conn, people["alan"]) is None
    solo = users.create(conn, full_name="Solo Dev", email="solo@example.com")
    assert notifications.deactivation_notice(conn, solo["id"]) is None
