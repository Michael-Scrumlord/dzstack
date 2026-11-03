"""Opening the SQLite database."""
import os
import sqlite3

DEFAULT_PATH = "staffdir.db"


def database_path(env=None) -> str:
    """The database file: STAFFDIR_DB if set, otherwise ./staffdir.db."""
    env = os.environ if env is None else env
    return env.get("STAFFDIR_DB", DEFAULT_PATH)


def connect(path=None) -> sqlite3.Connection:
    """A connection whose rows behave like mappings and that enforces foreign keys."""
    conn = sqlite3.connect(path or database_path())
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn
