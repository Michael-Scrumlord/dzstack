"""Recurrence rules and their text syntax (docs/rules.md).

    daily 09:00             weekly mon,wed,fri 09:00        monthly 15 09:00        every 15 minutes
"""
from __future__ import annotations

import calendar as _calendar
import re
from dataclasses import dataclass, field
from datetime import date, datetime, time, timedelta
from functools import lru_cache

from schedkit.errors import RuleError, RuleSyntaxError
from schedkit.timeutil import ensure_aware, from_local_naive, to_local_naive

MAX_SCAN_DAYS = 800
_WEEKDAYS = ("mon", "tue", "wed", "thu", "fri", "sat", "sun")
_TIME = re.compile(r"(\d{1,2}):(\d{2})\Z")
_UNITS = {"minute": 60, "minutes": 60, "hour": 3600, "hours": 3600, "day": 86400, "days": 86400}


@dataclass
class Rule:
    """When a job runs. A rule can be told to skip dates (`skip`), which changes that rule object."""

    text: str
    skipped: set[date] = field(default_factory=set)

    def skip(self, day: date) -> None:
        """Never run on this local calendar date."""
        self.skipped.add(day)

    def unskip(self, day: date) -> None:
        self.skipped.discard(day)

    def next_after(self, after: datetime) -> datetime:
        """The first run strictly after `after`, as an aware UTC datetime."""
        raise NotImplementedError

    def occurrences(self, after: datetime, count: int) -> list[datetime]:
        runs = []
        current = after
        for _ in range(count):
            current = self.next_after(current)
            runs.append(current)
        return runs

    def describe(self) -> str:
        raise NotImplementedError


@dataclass
class _AtTime(Rule):
    at: time = time(0, 0)

    def _matches(self, day: date) -> bool:
        raise NotImplementedError

    def next_after(self, after: datetime) -> datetime:
        local_after = to_local_naive(ensure_aware(after))
        day = local_after.date()
        for _ in range(MAX_SCAN_DAYS):
            if self._matches(day) and day not in self.skipped:
                candidate = datetime.combine(day, self.at)
                if candidate > local_after:
                    return from_local_naive(candidate)
            day += timedelta(days=1)
        raise RuleError(f"{self.text!r} has no run in the next {MAX_SCAN_DAYS} days")


@dataclass
class Daily(_AtTime):
    def _matches(self, day: date) -> bool:
        return True

    def describe(self) -> str:
        return f"every day at {self.at:%H:%M}"


@dataclass
class Weekly(_AtTime):
    weekdays: tuple[int, ...] = ()

    def _matches(self, day: date) -> bool:
        return day.weekday() in self.weekdays

    def describe(self) -> str:
        names = ", ".join(_WEEKDAYS[d] for d in self.weekdays)
        return f"every {names} at {self.at:%H:%M}"


@dataclass
class Monthly(_AtTime):
    day_of_month: int = 1

    def _matches(self, day: date) -> bool:
        last = _calendar.monthrange(day.year, day.month)[1]
        return day.day == min(self.day_of_month, last)

    def describe(self) -> str:
        return f"on day {self.day_of_month} of every month at {self.at:%H:%M}"


@dataclass
class Every(Rule):
    interval: timedelta = timedelta(minutes=1)

    def skip(self, day: date) -> None:
        raise RuleError("an `every` rule runs around the clock; it cannot skip dates")

    def next_after(self, after: datetime) -> datetime:
        return ensure_aware(after) + self.interval

    def describe(self) -> str:
        seconds = int(self.interval.total_seconds())
        for unit, size in (("day", 86400), ("hour", 3600), ("minute", 60)):
            if seconds % size == 0:
                n = seconds // size
                return f"every {n} {unit}{'' if n == 1 else 's'}"
        return f"every {seconds} seconds"


def _parse_time(text: str, rule: str) -> time:
    m = _TIME.match(text)
    if not m or int(m.group(1)) > 23 or int(m.group(2)) > 59:
        raise RuleSyntaxError(f"{rule!r}: {text!r} is not a time of day (HH:MM, 24-hour)")
    return time(int(m.group(1)), int(m.group(2)))


def _parse_weekdays(text: str, rule: str) -> tuple[int, ...]:
    days: set[int] = set()
    for part in text.split(","):
        lo, _, hi = part.partition("-")
        if lo not in _WEEKDAYS or (hi and hi not in _WEEKDAYS):
            raise RuleSyntaxError(f"{rule!r}: {part!r} is not a weekday (mon..sun)")
        a, b = _WEEKDAYS.index(lo), _WEEKDAYS.index(hi or lo)
        days.update(range(a, b + 1) if a <= b else [*range(a, 7), *range(0, b + 1)])
    return tuple(sorted(days))


@lru_cache(maxsize=512)
def parse_rule(text: str) -> Rule:
    """Parses a rule string (docs/rules.md). Parsing is cached, so a rule text is only read once."""
    words = text.strip().lower().split()
    if not words:
        raise RuleSyntaxError("empty rule")
    kind, args = words[0], words[1:]
    if kind == "daily" and len(args) == 1:
        return Daily(text, at=_parse_time(args[0], text))
    if kind == "weekly" and len(args) == 2:
        return Weekly(text, at=_parse_time(args[1], text), weekdays=_parse_weekdays(args[0], text))
    if kind == "monthly" and len(args) == 2:
        if not args[0].isdigit() or not 1 <= int(args[0]) <= 31:
            raise RuleSyntaxError(f"{text!r}: the day of the month must be 1 to 31")
        return Monthly(text, at=_parse_time(args[1], text), day_of_month=int(args[0]))
    if kind == "every" and len(args) == 2 and args[0].isdigit() and args[1] in _UNITS and int(args[0]) > 0:
        return Every(text, interval=timedelta(seconds=int(args[0]) * _UNITS[args[1]]))
    raise RuleSyntaxError(f"{text!r}: expected daily HH:MM, weekly DAYS HH:MM, monthly DAY HH:MM or every N minutes|hours|days")
