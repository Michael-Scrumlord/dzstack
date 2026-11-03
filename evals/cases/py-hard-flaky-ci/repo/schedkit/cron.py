"""Imports the cron expressions of the old crontab into rules. Only the shapes schedkit has rules for."""
from __future__ import annotations

from datetime import time

from schedkit.errors import RuleSyntaxError
from schedkit.rules import Daily, Monthly, Rule, Weekly, parse_rule


def _single(field: str, low: int, high: int, name: str, expression: str) -> int:
    if not field.isdigit() or not low <= int(field) <= high:
        raise RuleSyntaxError(f"{expression!r}: {name} must be a number from {low} to {high}")
    return int(field)


def parse_cron(expression: str) -> Rule:
    """`M H * * *` -> daily, `M H * * D[,D|-D]` -> weekly (0 or 7 is Sunday), `M H D * *` -> monthly, `*/N * * * *` -> every.

    Lists of minutes or hours, month fields and `L`/`W` extensions are not supported and raise RuleSyntaxError.
    """
    parts = expression.split()
    if len(parts) != 5:
        raise RuleSyntaxError(f"{expression!r}: a cron expression has five fields")
    minute, hour, dom, month, dow = parts
    if month != "*":
        raise RuleSyntaxError(f"{expression!r}: month fields are not supported")
    if minute.startswith("*/") and parts[1:] == ["*"] * 4:
        step = _single(minute[2:], 1, 59, "the step", expression)
        return parse_rule(f"every {step} minutes")
    at = time(_single(hour, 0, 23, "the hour", expression), _single(minute, 0, 59, "the minute", expression))
    clock = f"{at:%H:%M}"
    if dom == "*" and dow == "*":
        return Daily(f"daily {clock}", at=at)
    if dom == "*":
        names = ("sun", "mon", "tue", "wed", "thu", "fri", "sat")
        days: list[str] = []
        for part in dow.split(","):
            lo, _, hi = part.partition("-")
            first = _single(lo, 0, 7, "the weekday", expression) % 7
            last = _single(hi, 0, 7, "the weekday", expression) % 7 if hi else first
            days.append(names[first] if first == last else f"{names[first]}-{names[last]}")
        return parse_rule(f"weekly {','.join(days)} {clock}")
    if dow == "*":
        return Monthly(f"monthly {int(dom)} {clock}", at=at, day_of_month=_single(dom, 1, 31, "the day of the month", expression))
    raise RuleSyntaxError(f"{expression!r}: day-of-month together with weekday is not supported")
