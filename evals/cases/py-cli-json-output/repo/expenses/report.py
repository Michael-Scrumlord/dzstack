"""Group expenses by category."""
from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from typing import Iterable

from .loader import Expense


@dataclass(frozen=True)
class CategoryTotal:
    category: str
    count: int
    total: Decimal


@dataclass(frozen=True)
class Summary:
    categories: list[CategoryTotal]
    count: int
    total: Decimal


def summarize(expenses: Iterable[Expense], month: str | None = None, sort: str = "total") -> Summary:
    """Total the expenses per category. `month` is "YYYY-MM"; `sort` is "total" or "name"."""
    counts: dict[str, int] = {}
    totals: dict[str, Decimal] = {}
    for e in expenses:
        if month is not None and e.date.strftime("%Y-%m") != month:
            continue
        counts[e.category] = counts.get(e.category, 0) + 1
        totals[e.category] = totals.get(e.category, Decimal("0")) + e.amount
    rows = [CategoryTotal(name, counts[name], totals[name]) for name in totals]
    if sort == "name":
        rows.sort(key=lambda r: (r.category.casefold(), r.category))
    else:
        rows.sort(key=lambda r: (-r.total, r.category))
    return Summary(rows, sum(counts.values()), sum(totals.values(), Decimal("0")))
