"""Report definitions: a source, its columns and the transforms applied to its rows."""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable, Iterator, Mapping

from reportly.columns import Column, parse_columns
from reportly.errors import ConfigError
from reportly.sources import Source, build_source
from reportly.transform import first, only_where


@dataclass
class Report:
    name: str
    source: Source
    where: Mapping[str, Any]
    limit: int | None = None

    @property
    def columns(self) -> tuple[Column, ...]:
        return tuple(self.source.columns)

    def rows(self) -> Iterator[tuple[Any, ...]]:
        rows: Iterable[tuple[Any, ...]] = self.source.rows()
        if self.where:
            rows = only_where(rows, self.columns, self.where)
        if self.limit is not None:
            rows = first(rows, self.limit)
        return iter(rows)


def build_reports(raw: Mapping[str, Any], base_dir: Path) -> dict[str, Report]:
    reports = {}
    for name, settings in raw.items():
        where = f"reports.{name}"
        if not isinstance(settings, dict):
            raise ConfigError(f"{where}: expected a table")
        columns = parse_columns(settings.get("columns"), f"{where}.columns")
        source = build_source(str(settings.get("source", "")), columns, settings, base_dir)
        conditions = settings.get("where", {})
        if not isinstance(conditions, dict):
            raise ConfigError(f"{where}.where: expected a table of column = value")
        limit = settings.get("limit")
        if limit is not None and (isinstance(limit, bool) or not isinstance(limit, int)):
            raise ConfigError(f"{where}.limit: expected a whole number")
        reports[name] = Report(name, source, conditions, limit)
    return reports
