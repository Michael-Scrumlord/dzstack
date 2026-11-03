"""Payment reminders for issued invoices that are past their due date."""
from __future__ import annotations

from datetime import date, timedelta
from typing import Iterable

from .money import format_cents


def due_date(data: dict) -> date:
    return date.fromisoformat(data["issued"]) + timedelta(days=data["terms_days"])


def overdue(invoices: Iterable[dict], paid: set[str], today: date) -> list[dict]:
    """Unpaid invoices whose due date is before `today`, oldest due date first."""
    found = []
    for data in invoices:
        if data["number"] in paid:
            continue
        due = due_date(data)
        if due < today:
            found.append(
                {
                    "number": data["number"],
                    "customer": data["customer"]["name"],
                    "currency": data["currency"],
                    "due": due.isoformat(),
                    "days_overdue": (today - due).days,
                    "amount_cents": data["total_cents"],
                }
            )
    return sorted(found, key=lambda e: (e["due"], e["number"]))


def reminder_text(entry: dict) -> str:
    amount = format_cents(entry["amount_cents"], entry["currency"])
    days = entry["days_overdue"]
    return (
        f"Dear {entry['customer']}, invoice {entry['number']} for {amount} was due on {entry['due']} "
        f"and is {days} day{'s' if days != 1 else ''} overdue. Please pay at your earliest convenience."
    )
