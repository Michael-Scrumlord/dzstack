"""Plain-text table. Needs every row before it can write the first (column widths), so it does not stream."""
from __future__ import annotations

from typing import Any, Iterable, Sequence, TextIO

from reportly.columns import Column
from reportly.errors import RowError
from reportly.formatting import display
from reportly.plugins import FormatBase, Option, register_format
from reportly.util.text import truncate


def _max_width_ok(value: int) -> None:
    if value < 0:
        raise ValueError("must be 0 (no limit) or more")


@register_format
class TextFormat(FormatBase):
    name = "text"
    extension = ".txt"
    content_type = "text/plain; charset=utf-8"
    description = "aligned plain-text table"
    streaming = False
    options = {
        "max_width": Option(int, 0, "cut cells longer than this many characters (0: never)", _max_width_ok),
    }

    def render(self, columns: Sequence[Column], rows: Iterable[Sequence[Any]], out: TextIO) -> None:
        limit = self.opts["max_width"]
        cells: list[list[str]] = []
        for number, row in enumerate(rows, 1):
            if len(row) != len(columns):
                raise RowError(number, len(columns), len(row))
            cells.append([truncate(display(v), limit) for v in row])

        widths = [len(c.title) for c in columns]
        for row in cells:
            widths = [max(w, len(cell)) for w, cell in zip(widths, row)]

        def line(values: Sequence[str]) -> str:
            parts = [v.rjust(w) if c.numeric else v.ljust(w) for v, w, c in zip(values, widths, columns)]
            return "  ".join(parts).rstrip()

        out.write(line([c.title for c in columns]) + "\n")
        out.write("  ".join("-" * w for w in widths) + "\n")
        for row in cells:
            out.write(line(row) + "\n")
        out.write(f"({len(cells)} rows)\n")
