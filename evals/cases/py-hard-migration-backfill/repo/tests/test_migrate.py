import sqlite3

import pytest

from staffdir import db, migrate


def write(directory, name, text):
    (directory / name).write_text(text, encoding="utf-8")


def test_runs_every_migration_once(tmp_path):
    conn = db.connect(str(tmp_path / "x.db"))
    first = migrate.run(conn)
    assert first == [m.version for m in migrate.discover()]
    assert migrate.run(conn) == []
    assert migrate.applied_versions(conn) == first


def test_discover_is_in_version_order_and_ignores_other_files(tmp_path):
    for name in ("0002_b.sql", "0001_a.sql", "README.txt", "notes.py", "0003_c.py"):
        write(tmp_path, name, "SELECT 1;")
    assert [m.name for m in migrate.discover(tmp_path)] == ["a", "b", "c"]


def test_two_files_with_one_version_are_refused(tmp_path):
    write(tmp_path, "0001_a.sql", "SELECT 1;")
    write(tmp_path, "0001_b.sql", "SELECT 1;")
    with pytest.raises(migrate.MigrationError, match="share version 0001"):
        migrate.discover(tmp_path)


def test_a_failing_migration_leaves_nothing_behind(tmp_path):
    write(tmp_path, "0001_ok.sql", "CREATE TABLE a (x INTEGER);")
    write(tmp_path, "0002_bad.sql", "CREATE TABLE b (x INTEGER);\nINSERT INTO nowhere VALUES (1);")
    conn = db.connect(":memory:")
    with pytest.raises(migrate.MigrationError, match="0002_bad.sql failed"):
        migrate.run(conn, tmp_path)
    assert migrate.applied_versions(conn) == ["0001"]
    tables = {row[0] for row in conn.execute("SELECT name FROM sqlite_master WHERE type = 'table'")}
    assert "a" in tables and "b" not in tables


def test_python_migrations_run_in_the_runners_transaction(tmp_path):
    write(tmp_path, "0001_a.sql", "CREATE TABLE a (x INTEGER);")
    write(
        tmp_path,
        "0002_py.py",
        "def up(conn):\n    conn.execute('INSERT INTO a VALUES (1)')\n    raise RuntimeError('boom')\n",
    )
    conn = db.connect(":memory:")
    with pytest.raises(migrate.MigrationError, match="boom"):
        migrate.run(conn, tmp_path)
    assert conn.execute("SELECT COUNT(*) FROM a").fetchone()[0] == 0


def test_triggers_survive_the_statement_splitter(tmp_path):
    write(
        tmp_path,
        "0001_t.sql",
        "CREATE TABLE a (x INTEGER);\nCREATE TABLE log (x INTEGER);\n"
        "CREATE TRIGGER a_ai AFTER INSERT ON a BEGIN\n    INSERT INTO log VALUES (NEW.x);\nEND;\n",
    )
    conn = db.connect(":memory:")
    migrate.run(conn, tmp_path)
    conn.execute("INSERT INTO a VALUES (7)")
    assert conn.execute("SELECT x FROM log").fetchone()[0] == 7


def test_a_database_from_a_newer_release_is_refused():
    conn = db.connect(":memory:")
    migrate.run(conn)
    conn.execute("INSERT INTO schema_migrations VALUES ('9999', 'future', 'now')")
    conn.commit()
    with pytest.raises(migrate.MigrationError, match="9999"):
        migrate.run(conn)


def test_the_connection_keeps_its_isolation_level():
    conn = db.connect(":memory:")
    before = conn.isolation_level
    migrate.run(conn)
    assert conn.isolation_level == before
    assert isinstance(conn, sqlite3.Connection)
