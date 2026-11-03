"""Data sources. A source yields rows lazily; see docs/sources.md."""
from __future__ import annotations

from typing import Any, Mapping

from reportly.columns import Column
from reportly.errors import ConfigError
from reportly.sources.base import Source
from reportly.sources.jsonl import JsonlSource
from reportly.sources.memory import MemorySource
from reportly.sources.sqlite import SqliteSource

__all__ = ["JsonlSource", "MemorySource", "Source", "SqliteSource", "build_source"]

_KINDS = {"jsonl": JsonlSource, "sqlite": SqliteSource}


def build_source(kind: str, columns: tuple[Column, ...], settings: Mapping[str, Any], base_dir) -> Source:
    try:
        cls = _KINDS[kind]
    except KeyError:
        raise ConfigError(f"unknown source {kind!r} (available: {', '.join(sorted(_KINDS))})") from None
    return cls.from_settings(columns, settings, base_dir)
