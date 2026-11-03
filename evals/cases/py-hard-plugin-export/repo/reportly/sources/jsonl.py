from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Iterator, Mapping

from reportly.columns import Column, convert
from reportly.errors import ConfigError, SourceError
from reportly.sources.base import reject_unknown


class JsonlSource:
    """One JSON object per line. Missing keys are None; blank lines are skipped."""

    def __init__(self, columns: tuple[Column, ...], path: Path):
        self.columns = columns
        self.path = path

    @classmethod
    def from_settings(cls, columns: tuple[Column, ...], settings: Mapping[str, Any], base_dir: Path) -> "JsonlSource":
        reject_unknown(settings, {"source", "path", "columns", "where", "limit"}, "jsonl report")
        if "path" not in settings:
            raise ConfigError("jsonl report: `path` is required")
        return cls(columns, (base_dir / str(settings["path"])).resolve())

    def rows(self) -> Iterator[tuple[Any, ...]]:
        try:
            handle = self.path.open(encoding="utf-8")
        except OSError as exc:
            raise SourceError(f"cannot open {self.path}: {exc.strerror}") from exc
        with handle:
            for number, line in enumerate(handle, 1):
                if not line.strip():
                    continue
                try:
                    obj = json.loads(line)
                except json.JSONDecodeError as exc:
                    raise SourceError(f"{self.path.name}:{number}: not valid JSON ({exc.msg})") from exc
                if not isinstance(obj, dict):
                    raise SourceError(f"{self.path.name}:{number}: expected an object")
                yield tuple(convert(c.kind, obj.get(c.key)) for c in self.columns)
