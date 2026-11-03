from datetime import date, datetime, timedelta

from schedkit.clock import UTC, ManualClock
from schedkit.timeutil import local_zone

# Days on which clocks change somewhere: US and EU spring/autumn, and Australia (southern hemisphere).
TRANSITION_DAYS = [
    date(2025, 3, 9),  # US: forward
    date(2025, 3, 30),  # EU: forward
    date(2025, 4, 6),  # AU (Sydney): back
    date(2025, 10, 5),  # AU (Sydney): forward
    date(2025, 10, 26),  # EU: back
    date(2025, 11, 2),  # US: back
]


def at(year, month, day, hour=0, minute=0):
    """The instant (aware, UTC) at which the wall clock in this machine's zone shows this time. A time that does not
    exist is read with the offset from before the change (02:30 in the gap is 03:30 after it); a time that happens
    twice is the first one. (Instants are compared in UTC: Python never calls a gap or repeated time in another zone equal.)"""
    return datetime(year, month, day, hour, minute, tzinfo=local_zone()).astimezone(UTC)


def clock_at(year, month, day, hour=0, minute=0) -> ManualClock:
    return ManualClock(at(year, month, day, hour, minute))


def utc(year, month, day, hour=0, minute=0):
    return datetime(year, month, day, hour, minute, tzinfo=UTC)


def quarter_hours(start: datetime, hours: int):
    """Instants every 15 minutes, `hours` hours long."""
    return [start + timedelta(minutes=15 * i) for i in range(hours * 4)]
