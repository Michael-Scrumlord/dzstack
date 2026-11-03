"""Plain text output."""
from __future__ import annotations

from decimal import Decimal

from .report import Summary


def money(value: Decimal) -> str:
    return f"{value:,.2f}"


def render_text(summary: Summary) -> str:
    rows = [(c.category, str(c.count), money(c.total)) for c in summary.categories]
    foot = ("Total", str(summary.count), money(summary.total))
    head = ("Category", "Count", "Total")
    widths = [max(len(r[i]) for r in [head, foot, *rows]) for i in range(3)]

    def line(cells: tuple[str, str, str]) -> str:
        name, count, total = cells
        return f"{name:<{widths[0]}}  {count:>{widths[1]}}  {total:>{widths[2]}}".rstrip()

    rule = "  ".join("-" * w for w in widths)
    return "\n".join([line(head), rule, *map(line, rows), rule, line(foot)]) + "\n"
