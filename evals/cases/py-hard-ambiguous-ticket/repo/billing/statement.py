"""A customer statement: their issued invoices in order, with a running balance of what is still unpaid."""
from __future__ import annotations

from typing import Iterable

from .layout import RULE, left, right
from .money import format_cents
from .reminders import due_date


def statement(invoices: Iterable[dict], customer: str, paid: set[str]) -> list[dict]:
    """One entry per invoice of `customer`, oldest first, with the open balance after it."""
    rows, balance = [], 0
    for data in sorted(invoices, key=lambda d: (d["issued"], d["number"])):
        if data["customer"]["name"] != customer:
            continue
        settled = data["number"] in paid
        if not settled:
            balance += data["total_cents"]
        rows.append(
            {
                "number": data["number"],
                "issued": data["issued"],
                "due": due_date(data).isoformat(),
                "currency": data["currency"],
                "amount_cents": data["total_cents"],
                "paid": settled,
                "balance_cents": balance,
            }
        )
    return rows


def render_statement(customer: str, rows: list[dict]) -> str:
    out = [f"Statement for {customer}", "", left("Invoice", 12) + left("Issued", 12) + left("Due", 12)
           + right("Amount", 14) + right("Open balance", 16) + "  Paid", RULE]
    for row in rows:
        cur = row["currency"]
        out.append(
            left(row["number"], 12) + left(row["issued"], 12) + left(row["due"], 12)
            + right(format_cents(row["amount_cents"], cur), 14)
            + right(format_cents(row["balance_cents"], cur), 16)
            + ("  yes" if row["paid"] else "")
        )
    if not rows:
        out.append("(no invoices)")
    return "\n".join(out) + "\n"
