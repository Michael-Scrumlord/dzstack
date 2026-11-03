"""GitHub-flavoured Markdown table. Rows are written one at a time, so it streams."""
from __future__ import annotations

from typing import Any, Iterable, Sequence, TextIO

from reportly.columns import Column
from reportly.errors import RowError
from reportly.formatting import display
from reportly.plugins import FormatBase, Option, register_format


def _escape(text: str) -> str:
    return text.replace("\\", "\\\\").replace("|", "\\|")


@register_format
class MarkdownFormat(FormatBase):
    name = "markdown"
    extension = ".md"
    content_type = "text/markdown; charset=utf-8"
    description = "GitHub-flavoured Markdown table"
    streaming = True
    options = {
        "escape": Option(bool, True, "escape | and \\ in cells"),
    }

    def render(self, columns: Sequence[Column], rows: Iterable[Sequence[Any]], out: TextIO) -> None:
        escape = self.opts["escape"]

        def cell(value: Any) -> str:
            text = display(value)
            return _escape(text) if escape else text

        out.write("| " + " | ".join(_escape(c.title) if escape else c.title for c in columns) + " |\n")
        out.write("| " + " | ".join("---:" if c.numeric else "---" for c in columns) + " |\n")
        for number, row in enumerate(rows, 1):
            if len(row) != len(columns):
                raise RowError(number, len(columns), len(row))
            out.write("| " + " | ".join(cell(v) for v in row) + " |\n")
