from __future__ import annotations

from typing import Any, Iterable, Iterator, Sequence

from reportly.columns import Column


class MemorySource:
    """Rows handed in by the caller: a list, or any iterable (a generator streams)."""

    def __init__(self, columns: Sequence[Column], rows: Iterable[Sequence[Any]]):
        self.columns = tuple(columns)
        self._rows = rows

    def rows(self) -> Iterator[tuple[Any, ...]]:
        for row in self._rows:
            yield tuple(row)
