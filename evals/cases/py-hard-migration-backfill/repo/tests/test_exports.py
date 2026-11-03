import csv
import io

from staffdir import exports


def test_users_csv_has_one_row_per_user_in_name_order(conn, people):
    text = exports.users_csv(conn)
    assert text.splitlines()[0] == "id,full_name,email,team,status"
    rows = list(csv.DictReader(io.StringIO(text)))
    assert [r["full_name"] for r in rows] == ["Ada Lovelace", "Alan Turing", "Grace Hopper"]
    assert rows[0]["team"] == "Platform" and rows[1]["team"] == "Research"
    assert all(r["status"] == "active" for r in rows)


def test_users_without_a_team_have_an_empty_team_cell(conn):
    from staffdir import users

    users.create(conn, full_name="Solo Dev", email="solo@example.com")
    rows = list(csv.DictReader(io.StringIO(exports.users_csv(conn))))
    assert rows[0]["team"] == ""
