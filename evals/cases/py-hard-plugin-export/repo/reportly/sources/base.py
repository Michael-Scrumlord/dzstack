from __future__ import annotations

from typing import Any, Iterator, Mapping, Protocol, Sequence

from reportly.columns import Column


class Source(Protocol):
    columns: Sequence[Column]

    def rows(self) -> Iterator[tuple[Any, ...]]:
        """One tuple per row, one value per column, already converted to Python values. Lazy."""
        ...


def reject_unknown(settings: Mapping[str, Any], allowed: set[str], where: str) -> None:
    from reportly.errors import ConfigError

    unknown = sorted(set(settings) - allowed)
    if unknown:
        raise ConfigError(f"{where}: unknown setting {unknown[0]!r}")
