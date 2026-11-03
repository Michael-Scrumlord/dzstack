from staffdir import audit, users


def test_create_and_get(conn):
    user = users.create(conn, full_name="Ada Lovelace", email="ada@example.com", phone="+44 20 7946 0000")
    assert user["id"] == 1
    assert users.get(conn, 1)["full_name"] == "Ada Lovelace"
    assert users.get(conn, 99) is None
    assert users.get_by_email(conn, "ada@example.com")["id"] == 1
    assert user["status"] == "active"


def test_create_is_audited(conn):
    user = users.create(conn, full_name="Ada Lovelace", email="ada@example.com", actor="tester")
    entries = audit.for_subject(conn, user["id"])
    assert [(e["actor"], e["action"], e["detail"]) for e in entries] == [("tester", "user.created", "Ada Lovelace")]


def test_list_is_sorted_by_name_ignoring_case(conn):
    for name, email in [("bob Brown", "b@x.io"), ("Alice Zed", "a@x.io"), ("Carol Adams", "c@x.io")]:
        users.create(conn, full_name=name, email=email)
    assert [u["full_name"] for u in users.list_users(conn)] == ["Alice Zed", "bob Brown", "Carol Adams"]
    assert [u["email"] for u in users.list_users(conn, sort="email")] == ["a@x.io", "b@x.io", "c@x.io"]


def test_search_matches_part_of_the_name_ignoring_case(conn):
    users.create(conn, full_name="Ada Lovelace", email="ada@example.com")
    users.create(conn, full_name="Grace Hopper", email="grace@example.com")
    assert [u["email"] for u in users.list_users(conn, q="LOVE")] == ["ada@example.com"]
    assert users.count(conn, q="o") == 2
    assert users.list_users(conn, q="100%") == []


def test_search_treats_like_wildcards_literally(conn):
    users.create(conn, full_name="50% Off", email="a@x.io")
    users.create(conn, full_name="Anything", email="b@x.io")
    assert [u["email"] for u in users.list_users(conn, q="%")] == ["a@x.io"]
    assert [u["email"] for u in users.list_users(conn, q="_")] == []


def test_update_changes_only_what_it_is_given(conn):
    user = users.create(conn, full_name="Ada Lovelace", email="ada@example.com")
    updated = users.update(conn, user["id"], status="suspended")
    assert updated["status"] == "suspended" and updated["full_name"] == "Ada Lovelace"
    assert users.update(conn, 99, status="left") is None


def test_delete_clears_team_leads(conn, people):
    assert users.delete(conn, people["grace"]) is True
    assert users.get(conn, people["grace"]) is None
    assert conn.execute("SELECT lead_user_id FROM teams WHERE id = ?", (people["platform"],)).fetchone()[0] is None
    assert users.delete(conn, people["grace"]) is False


def test_email_changes_are_audited_by_the_database(conn):
    user = users.create(conn, full_name="Ada Lovelace", email="ada@example.com")
    users.update(conn, user["id"], email="ada@lovelace.org")
    actions = [e["action"] for e in audit.for_subject(conn, user["id"])]
    assert "user.email_changed" in actions
