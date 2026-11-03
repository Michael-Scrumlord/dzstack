"""Runs a report through a format."""
from __future__ import annotations

import contextlib
import sys
from pathlib import Path
from typing import Any, Iterator, Mapping, TextIO

from reportly.errors import ReportlyError
from reportly.plugins import get_format
from reportly.reports import Report


class _Counter:
    """Wraps a row iterator and counts what passes through, without keeping any of it."""

    def __init__(self, rows: Iterator[tuple[Any, ...]]):
        self._rows = rows
        self.count = 0

    def __iter__(self) -> "_Counter":
        return self

    def __next__(self) -> tuple[Any, ...]:
        row = next(self._rows)
        self.count += 1
        return row


def run_report(report: Report, format_name: str, out: TextIO, options: Mapping[str, Any] | None = None) -> int:
    """Renders `report` with the named format into `out`. Returns the number of rows written."""
    fmt = get_format(format_name)(**dict(options or {}))
    source_rows = report.rows()
    if fmt.streaming:
        rows = _Counter(source_rows)  # one-shot, lazy: the format pulls rows as it writes them
        fmt.render(report.columns, rows, out)
        return rows.count
    materialized = list(source_rows)  # formats that need every row first get a list
    fmt.render(report.columns, materialized, out)
    return len(materialized)


@contextlib.contextmanager
def open_output(path: str | None, stdout: TextIO | None = None) -> Iterator[TextIO]:
    """A text stream for the result: the file (UTF-8, no newline translation) or stdout."""
    if path is None:
        yield stdout if stdout is not None else sys.stdout
        return
    try:
        handle = open(path, "w", encoding="utf-8", newline="")
    except OSError as exc:
        raise ReportlyError(f"cannot write {path}: {exc.strerror}") from exc
    with handle:
        yield handle
