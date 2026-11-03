"""Lazy row transforms: filters and limits are generators, so a report never needs all its rows at once."""
from __future__ import annotations

from typing import Any, Iterable, Iterator, Mapping, Sequence

from reportly.columns import Column
from reportly.errors import ConfigError


def only_where(rows: Iterable[tuple[Any, ...]], columns: Sequence[Column], conditions: Mapping[str, Any]) -> Iterator[tuple[Any, ...]]:
    """Keeps rows whose column equals the given value, for every `column = value` pair."""
    index = {c.key: i for i, c in enumerate(columns)}
    wanted = []
    for key, value in conditions.items():
        if key not in index:
            raise ConfigError(f"where: no column {key!r}")
        wanted.append((index[key], value))
    for row in rows:
        if all(row[i] == value for i, value in wanted):
            yield row


def first(rows: Iterable[tuple[Any, ...]], count: int) -> Iterator[tuple[Any, ...]]:
    if count < 0:
        raise ConfigError("limit must be 0 or more")
    for taken, row in enumerate(rows):
        if taken >= count:
            return
        yield row
