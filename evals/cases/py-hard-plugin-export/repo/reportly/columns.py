"""Column definitions and the conversion of raw values (JSON, SQL) to Python values."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from typing import Any

from reportly.errors import ConfigError, SourceError

KINDS = ("text", "int", "decimal", "date", "datetime", "bool")
NUMERIC_KINDS = ("int", "decimal")


@dataclass(frozen=True)
class Column:
    key: str
    title: str
    kind: str = "text"

    @property
    def numeric(self) -> bool:
        return self.kind in NUMERIC_KINDS


def parse_columns(raw: Any, where: str = "columns") -> tuple[Column, ...]:
    """Columns from the config: a list of tables with `key`, optional `title` (default: the key) and `kind`."""
    if not isinstance(raw, list) or not raw:
        raise ConfigError(f"{where}: expected a non-empty list of columns")
    columns = []
    for i, item in enumerate(raw, 1):
        if not isinstance(item, dict) or "key" not in item:
            raise ConfigError(f"{where}[{i}]: a column needs a `key`")
        unknown = set(item) - {"key", "title", "kind"}
        if unknown:
            raise ConfigError(f"{where}[{i}]: unknown setting {sorted(unknown)[0]!r}")
        kind = item.get("kind", "text")
        if kind not in KINDS:
            raise ConfigError(f"{where}[{i}]: kind must be one of {', '.join(KINDS)}, not {kind!r}")
        columns.append(Column(str(item["key"]), str(item.get("title", item["key"])), kind))
    keys = [c.key for c in columns]
    if len(set(keys)) != len(keys):
        raise ConfigError(f"{where}: column keys must be unique")
    return tuple(columns)


def convert(kind: str, raw: Any) -> Any:
    """Raw value from a source -> the Python value formats receive. None stays None."""
    if raw is None:
        return None
    try:
        if kind == "text":
            return raw if isinstance(raw, str) else str(raw)
        if kind == "int":
            if isinstance(raw, bool):
                raise ValueError("a boolean is not a number")
            return int(raw)
        if kind == "decimal":
            return raw if isinstance(raw, Decimal) else Decimal(str(raw))
        if kind == "date":
            return raw if isinstance(raw, date) and not isinstance(raw, datetime) else date.fromisoformat(str(raw)[:10])
        if kind == "datetime":
            return raw if isinstance(raw, datetime) else datetime.fromisoformat(str(raw))
        if kind == "bool":
            if isinstance(raw, str):
                lowered = raw.strip().lower()
                if lowered in ("true", "yes", "1"):
                    return True
                if lowered in ("false", "no", "0"):
                    return False
                raise ValueError(f"{raw!r} is not a boolean")
            return bool(raw)
    except (ValueError, InvalidOperation) as exc:
        raise SourceError(f"cannot read {raw!r} as {kind}: {exc}") from exc
    raise SourceError(f"unknown column kind {kind!r}")
