"""Business days: weekends and holidays are skipped."""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, datetime, timedelta

from schedkit.timeutil import ensure_aware, from_local_naive, to_local_naive


@dataclass(frozen=True)
class BusinessCalendar:
    weekend: frozenset[int] = frozenset({5, 6})
    holidays: frozenset[date] = field(default_factory=frozenset)

    def is_business_day(self, day: date) -> bool:
        return day.weekday() not in self.weekend and day not in self.holidays

    def next_business_day(self, day: date) -> date:
        """`day` itself when it is a business day, else the next one."""
        while not self.is_business_day(day):
            day += timedelta(days=1)
        return day

    def business_days_between(self, start: date, end: date) -> int:
        """Business days in [start, end): the start counts, the end does not. Negative when end < start."""
        if end < start:
            return -self.business_days_between(end, start)
        count, day = 0, start
        while day < end:
            if self.is_business_day(day):
                count += 1
            day += timedelta(days=1)
        return count

    def add_business_days(self, moment: datetime, days: int) -> datetime:
        """The same local wall-clock time `days` business days later (or earlier), as an aware UTC datetime."""
        wall = to_local_naive(ensure_aware(moment))
        step = 1 if days >= 0 else -1
        day, left = wall.date(), abs(days)
        while left:
            day += timedelta(days=step)
            if self.is_business_day(day):
                left -= 1
        return from_local_naive(datetime.combine(day, wall.time()))
