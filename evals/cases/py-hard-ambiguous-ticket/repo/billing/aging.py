"""Accounts-receivable aging: how long unpaid invoices have been overdue, per customer."""
from __future__ import annotations

from collections import defaultdict
from datetime import date
from typing import Iterable

from .layout import left, right
from .money import format_cents
from .reminders import due_date

WIDTH = 82
RULE = "-" * WIDTH
BUCKETS = [("current", None), ("1-30", 30), ("31-60", 60), ("61-90", 90), ("90+", None)]


def bucket_for(days_overdue: int) -> str:
    """'current' when not yet due (or due today), then 1-30, 31-60, 61-90 and 90+ days overdue."""
    if days_overdue <= 0:
        return "current"
    for name, upper in BUCKETS[1:-1]:
        if days_overdue <= upper:
            return name
    return "90+"


def aging(invoices: Iterable[dict], paid: set[str], today: date) -> dict:
    """{customer: {bucket: cents}} for the unpaid invoices, plus the grand total per bucket under '*'."""
    table: dict[str, dict[str, int]] = defaultdict(lambda: {name: 0 for name, _ in BUCKETS})
    for data in invoices:
        if data["number"] in paid:
            continue
        bucket = bucket_for((today - due_date(data)).days)
        table[data["customer"]["name"]][bucket] += data["total_cents"]
        table["*"][bucket] += data["total_cents"]
    return dict(table)


def render_aging(table: dict, currency: str = "USD") -> str:
    names = [name for name, _ in BUCKETS]
    header = left("Customer", 20) + "".join(right(name, 10) for name in names) + right("Total", 12)
    out = [header, RULE]
    for customer in sorted(c for c in table if c != "*"):
        out.append(_row(customer, table[customer], names, currency))
    if "*" in table:
        out += [RULE, _row("All customers", table["*"], names, currency)]
    return "\n".join(out) + "\n"


def _row(label: str, buckets: dict, names: list[str], currency: str) -> str:
    cells = "".join(right(format_cents(buckets[name], currency), 10) for name in names)
    return left(label, 20) + cells + right(format_cents(sum(buckets.values()), currency), 12)
