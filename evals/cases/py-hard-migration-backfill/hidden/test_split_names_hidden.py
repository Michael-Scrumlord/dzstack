"""Hidden checks for the users.full_name split: the migration on awkward rows, running it twice,
no data loss, and an app that reads and writes the new columns (docs/migrations.md, docs/names.md)."""
import contextlib
import csv
import io
import sqlite3
import sys
from pathlib import Path

import pytest

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))

from staffdir import api, cli, db, migrate, notifications  # noqa: E402

BASELINE = (HERE / "baseline_dump.sql").read_text(encoding="utf-8")
BASELINE_VERSIONS = {"0001", "0002", "0003", "0004", "0005", "0006"}

# (full_name as the old release stored it, expected given_name, expected family_name)
FORMATS = [
    ("Cher", "Cher", ""),
    ("  Cher  ", "Cher", ""),
    ("Ada Lovelace", "Ada", "Lovelace"),
    ("Mary Jane Watson", "Mary Jane", "Watson"),
    ("  Mary   Jane \t Watson\n", "Mary Jane", "Watson"),
    ("Mary Jane Watson", "Mary Jane", "Watson"),
    ("Watson, Mary Jane", "Mary Jane", "Watson"),
    ("Watson,Mary", "Mary", "Watson"),
    ("  Watson ,  Mary   Jane ", "Mary Jane", "Watson"),
    ("van der Berg, Vincent", "Vincent", "van der Berg"),
    ("Ludwig van Beethoven", "Ludwig", "van Beethoven"),
    ("Vincent Van Der Berg", "Vincent", "Van Der Berg"),
    ("Anna Maria de la Cruz", "Anna Maria", "de la Cruz"),
    ("ANNA DE LA CRUZ", "ANNA", "DE LA CRUZ"),
    ("van Halen", "van", "Halen"),
    ("Jan de", "Jan", "de"),
    ("Watson,", "Watson", ""),
    (",Mary", "Mary", ""),
    (", ", "", ""),
    (None, "", ""),
    ("", "", ""),
    ("   ", "", ""),
    (" 　\t", "", ""),
    ("José Álvarez", "José", "Álvarez"),
    ("Zoë Müller-Schmidt", "Zoë", "Müller-Schmidt"),
    ("ÉMILE DE LA FONTAINE", "ÉMILE", "DE LA FONTAINE"),
    ("李　小龍", "李", "小龍"),
    ("李小龍", "李小龍", ""),
    ("José Alvarez", "José", "Alvarez"),
    ("Σωκράτης Παπαδόπουλος", "Σωκράτης", "Παπαδόπουλος"),
    ("Ольга Ивановна Петрова", "Ольга Ивановна", "Петрова"),
    ("J. R. R. Tolkien", "J. R. R.", "Tolkien"),
    ("e. e. cummings", "e. e.", "cummings"),
]


# ---------- helpers ----------

def baseline(tmp_path, rows=(), name="dir.db"):
    """A database exactly as the release before this change left it, plus the given
    (full_name, email, team_id) users. The old release only knows full_name."""
    path = str(tmp_path / name)
    conn = db.connect(path)
    conn.executescript(BASELINE)
    conn.execute("INSERT INTO teams (id, name) VALUES (1, 'Platform'), (2, 'Research')")
    for full_name, email, team_id in rows:
        conn.execute("INSERT INTO users (full_name, email, team_id) VALUES (?, ?, ?)", (full_name, email, team_id))
    conn.commit()
    return conn, path


def migrated(tmp_path, rows=(), name="dir.db"):
    conn, path = baseline(tmp_path, rows, name)
    applied = migrate.run(conn)
    assert applied, "migrate.run applied nothing: there is no new migration"
    assert not BASELINE_VERSIONS & set(applied)
    return conn, path, applied


def rerun(conn, applied):
    """Make the runner apply the new migration(s) again, as a restore or a half-finished rollout would."""
    conn.executemany("DELETE FROM schema_migrations WHERE version = ?", [(v,) for v in applied])
    conn.commit()
    assert migrate.run(conn) == applied


def table(conn, name, columns="*", order="id"):
    return [tuple(row) for row in conn.execute(f"SELECT {columns} FROM {name} ORDER BY {order}")]


def schema(conn):
    return {tuple(row) for row in conn.execute("SELECT type, name, tbl_name, sql FROM sqlite_master")}


def parts(conn):
    return {
        row["email"]: (row["given_name"], row["family_name"])
        for row in conn.execute("SELECT email, given_name, family_name FROM users")
    }


def format_rows():
    return [(full, f"u{i}@example.com", 1 if i % 3 == 0 else None) for i, (full, _, _) in enumerate(FORMATS)]


# ---------- the backfill ----------

class TestBackfill:
    def test_every_documented_format(self, tmp_path):
        conn, _, _ = migrated(tmp_path, format_rows())
        got = parts(conn)
        for i, (full, given, family) in enumerate(FORMATS):
            assert got[f"u{i}@example.com"] == (given, family), repr(full)

    def test_the_new_columns_are_nullable_text_and_nothing_is_left_null(self, tmp_path):
        conn, _, _ = migrated(tmp_path, format_rows())
        info = {row["name"]: row for row in conn.execute("PRAGMA table_info(users)")}
        for column in ("given_name", "family_name"):
            assert info[column]["type"].upper() == "TEXT"
            assert info[column]["notnull"] == 0
        assert conn.execute("SELECT COUNT(*) FROM users WHERE given_name IS NULL OR family_name IS NULL").fetchone()[0] == 0

    def test_no_data_is_lost(self, tmp_path):
        conn, path = baseline(tmp_path, format_rows())
        before_users = table(conn, "users", "id, full_name, email, team_id, status, phone, created_at")
        before_teams = table(conn, "teams")
        before_audit = table(conn, "audit_log")
        applied = migrate.run(conn)
        assert table(conn, "users", "id, full_name, email, team_id, status, phone, created_at") == before_users
        assert table(conn, "teams") == before_teams
        assert table(conn, "audit_log") == before_audit
        assert [r[0] for r in conn.execute("SELECT version FROM schema_migrations ORDER BY version")] == sorted(
            BASELINE_VERSIONS | set(applied)
        )
        # what already worked still works: the view, the email trigger
        assert conn.execute("SELECT COUNT(*) FROM team_roster").fetchone()[0] == sum(1 for r in format_rows() if r[2])
        conn.execute("UPDATE users SET email = 'changed@example.com' WHERE id = 1")
        assert conn.execute("SELECT COUNT(*) FROM audit_log WHERE action = 'user.email_changed'").fetchone()[0] == 1

    def test_a_database_with_no_users_migrates(self, tmp_path):
        conn, _, _ = migrated(tmp_path)
        assert conn.execute("SELECT COUNT(*) FROM users").fetchone()[0] == 0


# ---------- running it twice ----------

class TestRerun:
    def test_a_second_run_neither_fails_nor_changes_anything(self, tmp_path):
        conn, _, applied = migrated(tmp_path, format_rows())
        users_before = table(conn, "users")
        schema_before = schema(conn)
        rerun(conn, applied)
        rerun(conn, applied)
        assert table(conn, "users") == users_before
        assert schema(conn) == schema_before

    def test_values_corrected_since_the_first_run_stay(self, tmp_path):
        conn, _, applied = migrated(tmp_path, format_rows())
        conn.execute("UPDATE users SET given_name = 'Augusta Ada', family_name = 'King' WHERE email = 'u2@example.com'")
        conn.execute("UPDATE users SET family_name = '' WHERE email = 'u3@example.com'")
        conn.execute("UPDATE users SET given_name = '', family_name = '' WHERE email = 'u6@example.com'")
        conn.commit()
        before = parts(conn)
        rerun(conn, applied)
        assert parts(conn) == before

    def test_rows_the_old_release_wrote_in_between_are_filled_and_the_rest_left_alone(self, tmp_path):
        conn, _, applied = migrated(tmp_path, format_rows())
        conn.execute("UPDATE users SET given_name = 'Corrected' WHERE email = 'u2@example.com'")
        conn.executemany(
            "INSERT INTO users (full_name, email) VALUES (?, ?)",
            [("Watson, Mary Jane", "late1@example.com"), (None, "late2@example.com"), ("Ludwig van Beethoven", "late3@example.com")],
        )
        conn.execute("UPDATE users SET full_name = 'Somebody Else' WHERE email = 'u4@example.com'")  # old release edit
        conn.commit()
        before = parts(conn)
        assert before["late1@example.com"] == (None, None)
        rerun(conn, applied)
        after = parts(conn)
        assert after["late1@example.com"] == ("Mary Jane", "Watson")
        assert after["late2@example.com"] == ("", "")
        assert after["late3@example.com"] == ("Ludwig", "van Beethoven")
        for email in before:
            if not email.startswith("late"):
                assert after[email] == before[email], email

    def test_columns_that_exist_but_were_never_filled(self, tmp_path):
        # a rollout that stopped half way: the columns are there, the rows are not filled
        conn, _, applied = migrated(tmp_path, format_rows())
        conn.execute("UPDATE users SET given_name = NULL, family_name = NULL")
        conn.commit()
        rerun(conn, applied)
        got = parts(conn)
        for i, (full, given, family) in enumerate(FORMATS):
            assert got[f"u{i}@example.com"] == (given, family), repr(full)


# ---------- reads use the new columns ----------

STALE_USERS = [
    ("Ada Lovelace", "ada@example.com", 1),
    ("Grace Hopper", "grace@example.com", 1),
    ("Alan Turing", "alan@example.com", 2),
    ("Simone de Beauvoir", "simone@example.com", 2),
    ("Linus Torvalds", "linus@example.com", None),
    ("Abe Quill", "abe1@example.com", None),
    ("Abe Quill", "abe2@example.com", None),
]
# set after the migration, directly in the new columns; full_name is left as the old release wrote it
STALE_NAMES = {
    1: ("Zed", "Quill"),
    2: ("Hedy", "Lamarr"),
    3: ("Cher", ""),
    4: ("Émile", "de Beauvoir"),
    5: ("Linus", "Åkesson"),
    6: ("Abe", "quill"),
    7: ("abe", "QUILL"),
}
NAME_ORDER = [3, 4, 2, 6, 7, 1, 5]  # family name, then given name, ignoring case, then id


@pytest.fixture
def stale(tmp_path):
    conn, path, _ = migrated(tmp_path, STALE_USERS)
    conn.execute("UPDATE teams SET lead_user_id = 2 WHERE id = 1")
    for user_id, (given, family) in STALE_NAMES.items():
        conn.execute("UPDATE users SET given_name = ?, family_name = ? WHERE id = ?", (given, family, user_id))
    conn.commit()
    return conn, path


def display(user_id):
    return " ".join(p for p in STALE_NAMES[user_id] if p)


def ids(body):
    return [u["id"] for u in body["users"]]


class TestReads:
    def test_a_user_in_the_api(self, stale):
        conn, _ = stale
        for user_id, (given, family) in STALE_NAMES.items():
            status, body = api.handle(conn, "GET", f"/users/{user_id}")
            user = body["user"]
            assert status == 200
            assert (user["given_name"], user["family_name"], user["full_name"]) == (given, family, display(user_id))

    def test_the_listing_is_ordered_by_family_name_then_given_name(self, stale):
        conn, _ = stale
        status, body = api.handle(conn, "GET", "/users", {"per_page": "100"})
        assert status == 200 and ids(body) == NAME_ORDER
        assert [u["full_name"] for u in body["users"]] == [display(i) for i in NAME_ORDER]

    def test_search_looks_at_the_new_columns_only(self, stale):
        conn, _ = stale

        def search(q):
            status, body = api.handle(conn, "GET", "/users", {"q": q, "per_page": "100"})
            assert status == 200
            return ids(body)

        assert search("zed") == [1]
        assert search("ZED QUILL") == [1]
        assert search("quill") == [6, 7, 1]
        assert search("cher") == [3]
        assert search("Beauvoir") == [4]
        assert search("lovelace") == []  # the old full_name no longer matters
        assert search("ada") == []
        assert search("Hopper") == []
        assert search("simone") == []

    def test_team_lead_and_roster(self, stale):
        conn, _ = stale
        status, body = api.handle(conn, "GET", "/teams/1")
        lead = body["team"]["lead"]
        assert status == 200
        assert (lead["given_name"], lead["family_name"], lead["full_name"]) == ("Hedy", "Lamarr", "Hedy Lamarr")
        assert lead["email"] == "grace@example.com"
        status, body = api.handle(conn, "GET", "/teams/1/roster")
        assert status == 200
        assert [m["id"] for m in body["members"]] == [2, 1]
        for member in body["members"]:
            given, family = STALE_NAMES[member["id"]]
            assert (member["given_name"], member["family_name"], member["full_name"]) == (given, family, display(member["id"]))
        assert body["team"]["lead"]["given_name"] == "Hedy"

    def test_the_a_to_z_index(self, stale):
        conn, _ = stale
        status, body = api.handle(conn, "GET", "/directory/index")
        assert status == 200
        groups = {key: [u["id"] for u in members] for key, members in body["groups"].items()}
        assert groups == {"C": [3], "D": [4], "L": [2], "Q": [6, 7, 1], "Å": [5]}
        assert body["groups"]["Q"][2]["full_name"] == "Zed Quill"

    def test_the_csv_export(self, stale):
        conn, _ = stale
        from staffdir import exports

        rows = {int(r["id"]): r for r in csv.DictReader(io.StringIO(exports.users_csv(conn)))}
        assert set(rows) == set(STALE_NAMES)
        for user_id, (given, family) in STALE_NAMES.items():
            assert (rows[user_id]["given_name"], rows[user_id]["family_name"], rows[user_id]["full_name"]) == (
                given,
                family,
                display(user_id),
            )
        assert [int(r["id"]) for r in csv.DictReader(io.StringIO(exports.users_csv(conn)))] == NAME_ORDER

    def test_the_command_line(self, stale, capsys):
        conn, path = stale
        assert cli.main(["--db", path, "users", "list"]) == 0
        lines = capsys.readouterr().out.splitlines()
        assert lines == [f"{i:>4}  {display(i)}  <{conn.execute('SELECT email FROM users WHERE id = ?', (i,)).fetchone()[0]}>" for i in NAME_ORDER]
        assert cli.main(["--db", path, "users", "list", "--q", "zed"]) == 0
        assert capsys.readouterr().out.splitlines() == ["   1  Zed Quill  <ada@example.com>"]
        assert cli.main(["--db", path, "users", "show", "1"]) == 0
        assert capsys.readouterr().out.splitlines()[0] == "   1  Zed Quill  <ada@example.com>"

    def test_the_welcome_message_greets_with_the_given_name(self, stale):
        conn, _ = stale
        assert notifications.welcome_message(conn, 1)["body"].startswith("Hi Zed,\n")
        assert notifications.welcome_message(conn, 3)["body"].startswith("Hi Cher,\n")
        assert notifications.welcome_message(conn, 4)["body"].startswith("Hi Émile,\n")
        conn.execute("UPDATE users SET given_name = 'Mary Jane', family_name = 'Watson' WHERE id = 5")
        assert notifications.welcome_message(conn, 5)["body"].startswith("Hi Mary Jane,\n")
        conn.execute("UPDATE users SET given_name = '', family_name = 'Solo' WHERE id = 5")
        assert notifications.welcome_message(conn, 5)["body"].startswith("Hi Solo,\n")
        conn.execute("UPDATE users SET given_name = '', family_name = '' WHERE id = 5")
        assert notifications.welcome_message(conn, 5)["body"].startswith("Hi there,\n")

    def test_the_notice_to_a_team_lead_names_the_user(self, stale):
        conn, _ = stale
        notice = notifications.deactivation_notice(conn, 1)
        assert notice["to"] == "grace@example.com"
        assert notice["subject"] == "Zed Quill has left your team"
        assert "Zed Quill (ada@example.com)" in notice["body"]


# ---------- rows the old release wrote after the migration ----------

class TestOldReleaseRows:
    @pytest.fixture
    def mixed(self, tmp_path):
        conn, path, _ = migrated(tmp_path, [("Grace Hopper", "grace@example.com", 1)])
        conn.executemany(
            "INSERT INTO users (full_name, email, team_id) VALUES (?, ?, ?)",
            [("Watson, Mary Jane", "mj@example.com", 1), (None, "nobody@example.com", None), ("Ludwig van Beethoven", "lvb@example.com", 1)],
        )
        conn.commit()
        return conn, path

    def test_they_read_correctly_in_the_api(self, mixed):
        conn, _ = mixed
        status, body = api.handle(conn, "GET", "/users/2")
        user = body["user"]
        assert status == 200
        assert (user["given_name"], user["family_name"], user["full_name"]) == ("Mary Jane", "Watson", "Mary Jane Watson")
        user = api.handle(conn, "GET", "/users/3")[1]["user"]
        assert (user["given_name"], user["family_name"], user["full_name"]) == ("", "", "")
        _, body = api.handle(conn, "GET", "/users", {"per_page": "100"})
        by_id = {u["id"]: (u["given_name"], u["family_name"]) for u in body["users"]}
        assert by_id == {1: ("Grace", "Hopper"), 2: ("Mary Jane", "Watson"), 3: ("", ""), 4: ("Ludwig", "van Beethoven")}

    def test_they_read_correctly_in_the_roster_the_index_and_the_greeting(self, mixed):
        conn, _ = mixed
        _, body = api.handle(conn, "GET", "/teams/1/roster")
        members = {m["id"]: (m["given_name"], m["family_name"], m["full_name"]) for m in body["members"]}
        assert members[2] == ("Mary Jane", "Watson", "Mary Jane Watson")
        assert members[4] == ("Ludwig", "van Beethoven", "Ludwig van Beethoven")
        _, body = api.handle(conn, "GET", "/directory/index")
        assert [u["id"] for u in body["groups"]["W"]] == [2]
        assert [u["id"] for u in body["groups"]["V"]] == [4]
        assert notifications.welcome_message(conn, 2)["body"].startswith("Hi Mary Jane,\n")
        assert notifications.welcome_message(conn, 3)["body"].startswith("Hi there,\n")

    def test_reading_does_not_write(self, mixed):
        conn, _ = mixed
        api.handle(conn, "GET", "/users/2")
        api.handle(conn, "GET", "/users")
        assert conn.execute("SELECT given_name, family_name FROM users WHERE id = 2").fetchone()[0] is None

    def test_a_partial_update_starts_from_what_the_row_reads_as(self, mixed):
        conn, _ = mixed
        status, body = api.handle(conn, "PATCH", "/users/2", body={"family_name": "Parker"})
        assert status == 200
        assert (body["user"]["given_name"], body["user"]["family_name"]) == ("Mary Jane", "Parker")
        row = conn.execute("SELECT given_name, family_name, full_name FROM users WHERE id = 2").fetchone()
        assert tuple(row) == ("Mary Jane", "Parker", "Mary Jane Parker")


# ---------- writes ----------

def stored(conn, email):
    return tuple(conn.execute("SELECT given_name, family_name, full_name FROM users WHERE email = ?", (email,)).fetchone())


class TestWrites:
    @pytest.fixture
    def conn(self, tmp_path):
        conn, _, _ = migrated(tmp_path)
        return conn

    def test_create_from_parts(self, conn):
        status, body = api.handle(conn, "POST", "/users", body={"given_name": " Mary  Jane ", "family_name": " Watson", "email": "mj@example.com"})
        assert status == 201
        user = body["user"]
        assert (user["given_name"], user["family_name"], user["full_name"]) == ("Mary Jane", "Watson", "Mary Jane Watson")
        assert stored(conn, "mj@example.com") == ("Mary Jane", "Watson", "Mary Jane Watson")

    def test_create_from_a_full_name(self, conn):
        status, body = api.handle(conn, "POST", "/users", body={"full_name": "Watson, Mary Jane", "email": "mj@example.com"})
        assert status == 201
        assert (body["user"]["given_name"], body["user"]["family_name"]) == ("Mary Jane", "Watson")
        assert stored(conn, "mj@example.com") == ("Mary Jane", "Watson", "Mary Jane Watson")
        api.handle(conn, "POST", "/users", body={"full_name": "李　小龍", "email": "li@example.com"})
        assert stored(conn, "li@example.com") == ("李", "小龍", "李 小龍")

    def test_a_single_name_has_an_empty_not_a_null_family_name(self, conn):
        api.handle(conn, "POST", "/users", body={"given_name": "Cher", "email": "cher@example.com"})
        assert stored(conn, "cher@example.com") == ("Cher", "", "Cher")
        api.handle(conn, "POST", "/users", body={"family_name": "Solo", "email": "solo@example.com"})
        assert stored(conn, "solo@example.com") == ("", "Solo", "Solo")

    def test_update_one_part_or_a_full_name(self, conn):
        _, body = api.handle(conn, "POST", "/users", body={"full_name": "Ada Lovelace", "email": "ada@example.com"})
        uid = body["user"]["id"]
        status, body = api.handle(conn, "PATCH", f"/users/{uid}", body={"given_name": "Augusta Ada"})
        assert status == 200 and body["user"]["full_name"] == "Augusta Ada Lovelace"
        assert stored(conn, "ada@example.com") == ("Augusta Ada", "Lovelace", "Augusta Ada Lovelace")
        api.handle(conn, "PATCH", f"/users/{uid}", body={"family_name": ""})
        assert stored(conn, "ada@example.com") == ("Augusta Ada", "", "Augusta Ada")
        api.handle(conn, "PATCH", f"/users/{uid}", body={"full_name": "Ludwig van Beethoven"})
        assert stored(conn, "ada@example.com") == ("Ludwig", "van Beethoven", "Ludwig van Beethoven")
        status, body = api.handle(conn, "PATCH", f"/users/{uid}", body={"status": "suspended"})
        assert status == 200 and (body["user"]["given_name"], body["user"]["family_name"]) == ("Ludwig", "van Beethoven")

    def test_bad_names_are_rejected_and_change_nothing(self, conn):
        _, body = api.handle(conn, "POST", "/users", body={"full_name": "Ada Lovelace", "email": "ada@example.com"})
        uid = body["user"]["id"]
        assert api.handle(conn, "POST", "/users", body={"email": "none@example.com"})[0] == 400
        assert api.handle(conn, "POST", "/users", body={"given_name": " ", "family_name": "", "email": "none@example.com"})[0] == 400
        assert api.handle(conn, "POST", "/users", body={"full_name": "  ", "email": "none@example.com"})[0] == 400
        mixed = {"full_name": "Ada Lovelace", "given_name": "Ada", "email": "mix@example.com"}
        assert api.handle(conn, "POST", "/users", body=mixed)[0] == 400
        assert api.handle(conn, "PATCH", f"/users/{uid}", body={"full_name": "Ada", "family_name": "X"})[0] == 400
        assert api.handle(conn, "PATCH", f"/users/{uid}", body={"given_name": "", "family_name": ""})[0] == 400
        assert api.handle(conn, "PATCH", f"/users/{uid}", body={"given_name": 7})[0] == 400
        assert stored(conn, "ada@example.com") == ("Ada", "Lovelace", "Ada Lovelace")
        assert conn.execute("SELECT COUNT(*) FROM users").fetchone()[0] == 1

    def test_the_command_line_reads_a_full_name_and_takes_parts(self, tmp_path, capsys):
        conn, path, _ = migrated(tmp_path)
        assert cli.main(["--db", path, "users", "add", "--name", "Watson, Mary Jane", "--email", "mj@example.com"]) == 0
        assert capsys.readouterr().out.splitlines() == ["   1  Mary Jane Watson  <mj@example.com>"]
        assert stored(conn, "mj@example.com") == ("Mary Jane", "Watson", "Mary Jane Watson")
        assert cli.main(["--db", path, "users", "add", "--name", "   ", "--email", "x@example.com"]) == 2
