"""Fixed-width text helpers for the printed invoice (docs/rendering.md)."""
from __future__ import annotations

WIDTH = 72
RULE = "-" * WIDTH


def fit(text: str, width: int) -> str:
    """Cut text to `width` characters, ending in an ellipsis when something was removed."""
    return text if len(text) <= width else text[: width - 1] + "…"


def left(text: str, width: int) -> str:
    return fit(text, width).ljust(width)


def right(text: str, width: int) -> str:
    return fit(text, width).rjust(width)


def ends(first: str, last: str, width: int = WIDTH) -> str:
    """`first` at the left edge, `last` at the right edge."""
    gap = width - len(last)
    return left(first, gap - 1) + " " + last


def total_row(label: str, amount: str) -> str:
    """A row of the totals block: the label starts under the middle of the table, the amount sits at the right edge."""
    return " " * 36 + left(label, 24) + right(amount, 12)
