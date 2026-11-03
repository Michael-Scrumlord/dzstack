from staffdir import teams, users


def test_roster_is_by_name_and_skips_people_who_left(conn, people):
    users.update(conn, people["ada"], status="left")
    assert [m["full_name"] for m in teams.roster(conn, people["platform"])] == ["Grace Hopper"]
    assert len(teams.roster(conn, people["platform"], include_left=True)) == 2


def test_lead(conn, people):
    assert teams.lead(conn, people["platform"])["email"] == "grace@example.com"
    assert teams.lead(conn, people["research"]) is None
    teams.set_lead(conn, people["research"], people["alan"])
    assert teams.lead(conn, people["research"])["full_name"] == "Alan Turing"


def test_headcount_counts_current_members(conn, people):
    users.update(conn, people["ada"], status="left")
    counts = {t["name"]: t["members"] for t in teams.headcount(conn)}
    assert counts == {"Platform": 1, "Research": 1}


def test_teams_are_listed_by_name(conn, people):
    assert [t["name"] for t in teams.list_teams(conn)] == ["Platform", "Research"]
