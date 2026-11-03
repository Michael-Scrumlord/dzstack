from __future__ import annotations

from datetime import date, datetime, timedelta


def parse_relative(text: str, today: date) -> date:
    """Dates in report definitions: ISO dates, "today", "yesterday", or "-7d" / "+2w" offsets from today."""
    value = text.strip().lower()
    if value == "today":
        return today
    if value == "yesterday":
        return today - timedelta(days=1)
    if value[:1] in "+-" and value[-1:] in "dw" and value[1:-1].isdigit():
        days = int(value[1:-1]) * (7 if value[-1] == "w" else 1)
        return today + timedelta(days=days if value[0] == "+" else -days)
    return date.fromisoformat(value)


def month_start(day: date) -> date:
    return day.replace(day=1)


def month_end(day: date) -> date:
    nxt = day.replace(day=28) + timedelta(days=4)
    return nxt - timedelta(days=nxt.day)


def iso_week(day: date | datetime) -> str:
    year, week, _ = day.isocalendar()
    return f"{year}-W{week:02d}"
