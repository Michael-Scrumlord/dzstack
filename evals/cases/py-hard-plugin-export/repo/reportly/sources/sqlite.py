from __future__ import annotations

import sqlite3
from pathlib import Path
from typing import Any, Iterator, Mapping

from reportly.columns import Column, convert
from reportly.errors import ConfigError, SourceError
from reportly.sources.base import reject_unknown

FETCH_SIZE = 500


class SqliteSource:
    """Runs a read-only query; the result columns are matched to the report's columns by position."""

    def __init__(self, columns: tuple[Column, ...], path: Path, query: str):
        self.columns = columns
        self.path = path
        self.query = query

    @classmethod
    def from_settings(cls, columns: tuple[Column, ...], settings: Mapping[str, Any], base_dir: Path) -> "SqliteSource":
        reject_unknown(settings, {"source", "path", "query", "columns", "where", "limit"}, "sqlite report")
        for key in ("path", "query"):
            if key not in settings:
                raise ConfigError(f"sqlite report: `{key}` is required")
        return cls(columns, (base_dir / str(settings["path"])).resolve(), str(settings["query"]))

    def rows(self) -> Iterator[tuple[Any, ...]]:
        try:
            conn = sqlite3.connect(f"file:{self.path}?mode=ro", uri=True)
        except sqlite3.Error as exc:
            raise SourceError(f"cannot open {self.path}: {exc}") from exc
        try:
            cursor = conn.execute(self.query)
            if cursor.description is None or len(cursor.description) != len(self.columns):
                got = 0 if cursor.description is None else len(cursor.description)
                raise SourceError(f"query returns {got} columns, the report has {len(self.columns)}")
            while True:
                batch = cursor.fetchmany(FETCH_SIZE)
                if not batch:
                    return
                for record in batch:
                    yield tuple(convert(c.kind, v) for c, v in zip(self.columns, record))
        except sqlite3.Error as exc:
            raise SourceError(f"{self.path.name}: {exc}") from exc
        finally:
            conn.close()
