"""Public holidays for the business calendar: fixed dates and "nth weekday of a month" rules."""
from __future__ import annotations

import calendar as _calendar
from datetime import date, timedelta

from schedkit.calendar import BusinessCalendar


def nth_weekday(year: int, month: int, weekday: int, n: int) -> date:
    """The nth (1-based) given weekday of a month; n=-1 is the last one."""
    if n > 0:
        first = date(year, month, 1)
        return first + timedelta(days=(weekday - first.weekday()) % 7 + 7 * (n - 1))
    last = date(year, month, _calendar.monthrange(year, month)[1])
    return last - timedelta(days=(last.weekday() - weekday) % 7)


def observed(day: date) -> date:
    """A holiday on a Saturday is taken on the Friday before, one on a Sunday on the Monday after."""
    if day.weekday() == 5:
        return day - timedelta(days=1)
    if day.weekday() == 6:
        return day + timedelta(days=1)
    return day


def us_federal(year: int) -> frozenset[date]:
    days = [
        observed(date(year, 1, 1)),
        nth_weekday(year, 1, 0, 3),  # Martin Luther King Jr. Day
        nth_weekday(year, 2, 0, 3),  # Presidents' Day
        nth_weekday(year, 5, 0, -1),  # Memorial Day
        observed(date(year, 6, 19)),
        observed(date(year, 7, 4)),
        nth_weekday(year, 9, 0, 1),  # Labor Day
        nth_weekday(year, 10, 0, 2),  # Columbus Day
        observed(date(year, 11, 11)),
        nth_weekday(year, 11, 3, 4),  # Thanksgiving
        observed(date(year, 12, 25)),
    ]
    return frozenset(days)


def calendar_for(years: range, region: str = "us") -> BusinessCalendar:
    if region != "us":
        raise ValueError(f"no holiday table for region {region!r}")
    holidays: set[date] = set()
    for year in years:
        holidays |= us_federal(year)
    return BusinessCalendar(holidays=frozenset(holidays))
