"""The migration runner. See docs/migrations.md for the rules a migration follows.

A migration is a file in staffdir/migrations/ named NNNN_slug.sql or NNNN_slug.py. SQL files
hold plain statements; Python files define up(conn). Every migration runs in one transaction
together with the row that records it in schema_migrations.
"""
from __future__ import annotations

import importlib.util
import re
import sqlite3
import time
from dataclasses import dataclass
from pathlib import Path

MIGRATIONS_DIR = Path(__file__).parent / "migrations"
_FILE = re.compile(r"^(\d{4})_([a-z0-9_]+)\.(sql|py)$")


class MigrationError(RuntimeError):
    pass


@dataclass(frozen=True)
class Migration:
    version: str
    name: str
    path: Path
    kind: str  # "sql" or "py"


def discover(directory=None) -> list[Migration]:
    """Every migration file in the directory, in version order."""
    directory = Path(directory or MIGRATIONS_DIR)
    found: dict[str, Migration] = {}
    for path in sorted(directory.iterdir()):
        match = _FILE.match(path.name)
        if not match:
            continue
        version, name, kind = match.groups()
        if version in found:
            raise MigrationError(f"two migrations share version {version}: {found[version].path.name} and {path.name}")
        found[version] = Migration(version, name, path, kind)
    return [found[v] for v in sorted(found)]


def ensure_table(conn: sqlite3.Connection) -> None:
    conn.execute(
        "CREATE TABLE IF NOT EXISTS schema_migrations ("
        " version TEXT PRIMARY KEY,"
        " name TEXT NOT NULL,"
        " applied_at TEXT NOT NULL)"
    )
    conn.commit()


def applied_versions(conn: sqlite3.Connection) -> list[str]:
    ensure_table(conn)
    return [row[0] for row in conn.execute("SELECT version FROM schema_migrations ORDER BY version")]


def pending(conn: sqlite3.Connection, directory=None) -> list[Migration]:
    done = set(applied_versions(conn))
    return [m for m in discover(directory) if m.version not in done]


def run(conn: sqlite3.Connection, directory=None) -> list[str]:
    """Apply every pending migration, oldest first. Returns the versions applied."""
    known = {m.version for m in discover(directory)}
    unknown = [v for v in applied_versions(conn) if v not in known]
    if unknown:
        raise MigrationError(f"the database has migrations this release does not know: {', '.join(unknown)}")
    applied = []
    for migration in pending(conn, directory):
        _apply(conn, migration)
        applied.append(migration.version)
    return applied


def _apply(conn: sqlite3.Connection, migration: Migration) -> None:
    previous = conn.isolation_level
    conn.isolation_level = None  # we issue BEGIN and COMMIT ourselves
    try:
        conn.execute("BEGIN IMMEDIATE")
        try:
            if migration.kind == "sql":
                for statement in _statements(migration.path.read_text(encoding="utf-8")):
                    conn.execute(statement)
            else:
                _load(migration).up(conn)
            conn.execute(
                "INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)",
                (migration.version, migration.name, time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())),
            )
            conn.execute("COMMIT")
        except BaseException as error:
            if conn.in_transaction:
                conn.execute("ROLLBACK")
            if isinstance(error, Exception):
                raise MigrationError(f"{migration.path.name} failed: {error}") from error
            raise
    finally:
        conn.isolation_level = previous


def _statements(text: str):
    """Split a SQL file into statements. sqlite3.complete_statement understands triggers."""
    buffer = ""
    for line in text.splitlines(keepends=True):
        buffer += line
        if sqlite3.complete_statement(buffer):
            if buffer.strip():
                yield buffer.strip()
            buffer = ""
    if buffer.strip():
        raise MigrationError("the file ends in the middle of a statement")


def _load(migration: Migration):
    spec = importlib.util.spec_from_file_location(f"staffdir_migration_{migration.version}", migration.path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    if not callable(getattr(module, "up", None)):
        raise MigrationError(f"{migration.path.name} defines no up(conn)")
    return module
