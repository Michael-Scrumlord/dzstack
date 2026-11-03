"""Payment plans: split an invoice total into monthly instalments."""
from __future__ import annotations

import calendar
from datetime import date

from .money import split_even


def add_months(day: date, months: int) -> date:
    """The same day of the month, `months` later; the last day of the month if it does not exist there."""
    index = day.month - 1 + months
    year, month = day.year + index // 12, index % 12 + 1
    return date(year, month, min(day.day, calendar.monthrange(year, month)[1]))


def plan(total_cents: int, parts: int, first_due: date) -> list[dict]:
    """`parts` instalments, one a month from `first_due`. The first ones take the leftover cents."""
    if parts < 1 or parts > 24:
        raise ValueError("a plan has between 1 and 24 instalments")
    shares = split_even(total_cents, parts)
    return [{"due": add_months(first_due, i).isoformat(), "amount_cents": share} for i, share in enumerate(shares)]
