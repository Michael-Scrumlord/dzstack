"""Products in SQLite. Every call opens its own short connection, so threads never share one."""
import sqlite3
from contextlib import contextmanager
from dataclasses import dataclass

SCHEMA = """
CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    price_cents INTEGER NOT NULL,
    active INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS price_audit (
    id INTEGER PRIMARY KEY,
    product_id INTEGER NOT NULL,
    old_cents INTEGER NOT NULL,
    new_cents INTEGER NOT NULL,
    changed_by TEXT NOT NULL,
    changed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
"""


@dataclass(frozen=True)
class Product:
    id: int
    name: str
    price_cents: int
    active: bool


def _product(row):
    return Product(row["id"], row["name"], row["price_cents"], bool(row["active"]))


class Store:
    def __init__(self, path):
        self._path = path
        conn = self._connect()
        conn.executescript(SCHEMA)
        conn.close()

    def _connect(self):
        conn = sqlite3.connect(self._path, timeout=5)
        conn.row_factory = sqlite3.Row
        return conn

    @contextmanager
    def transaction(self):
        """One transaction on its own connection: commits when the block ends, rolls back if it raises."""
        conn = self._connect()
        try:
            yield conn
            conn.commit()
        except BaseException:
            conn.rollback()
            raise
        finally:
            conn.close()

    def add_product(self, name, price_cents):
        with self.transaction() as tx:
            cur = tx.execute("INSERT INTO products (name, price_cents) VALUES (?, ?)", (name, price_cents))
            return cur.lastrowid

    def get_product(self, product_id):
        conn = self._connect()
        try:
            row = conn.execute(
                "SELECT id, name, price_cents, active FROM products WHERE id = ?", (product_id,)
            ).fetchone()
        finally:
            conn.close()
        return _product(row) if row else None

    def list_active(self):
        conn = self._connect()
        try:
            rows = conn.execute(
                "SELECT id, name, price_cents, active FROM products WHERE active = 1 ORDER BY name"
            ).fetchall()
        finally:
            conn.close()
        return [_product(r) for r in rows]
