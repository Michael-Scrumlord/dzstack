from staffdir import reports, users


def test_index_groups_by_last_name_initial(conn, people):
    index = reports.index_by_initial(conn)
    assert list(index) == ["H", "L", "T"]
    assert [u["full_name"] for u in index["L"]] == ["Ada Lovelace"]


def test_non_letters_go_under_hash_and_sort_last(conn):
    users.create(conn, full_name="Zed 9", email="z.x@example.net")
    users.create(conn, full_name="Amy Adams", email="a.x@example.net")
    assert list(reports.index_by_initial(conn)) == ["A", "#"]


def test_status_summary_and_team_sizes(conn, people):
    users.update(conn, people["ada"], status="suspended")
    users.update(conn, people["alan"], status="left")
    assert reports.status_summary(conn) == {"active": 1, "suspended": 1, "left": 1}
    assert reports.team_sizes(conn) == [("Platform", 2)]
