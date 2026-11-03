"""Conversions between instants (aware datetimes) and the wall-clock time on this machine.

Rules are written in local time ("daily 09:00" means 09:00 where the scheduler runs), the clock and the job
store deal in UTC instants, and these helpers are the only place the two meet. See docs/timezones.md.
"""
from __future__ import annotations

import os
from datetime import datetime, timezone, tzinfo
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

UTC = timezone.utc


def local_zone() -> tzinfo:
    """This machine's time zone: the IANA name in $TZ, or UTC when $TZ is unset or not a zone name."""
    name = os.environ.get("TZ", "").lstrip(":")
    if name:
        try:
            return ZoneInfo(name)
        except (ZoneInfoNotFoundError, ValueError):
            pass
    return UTC


def ensure_aware(moment: datetime) -> datetime:
    """Aware datetimes pass through; naive ones are taken to be UTC, as the clock would give them."""
    if moment.tzinfo is None or moment.utcoffset() is None:
        return moment.replace(tzinfo=UTC)
    return moment


def to_local_naive(moment: datetime) -> datetime:
    """The wall-clock time on this machine at an instant, without a tzinfo.

    Exactly one of the two wall-clock times that repeat when the clocks go back carries fold=1.
    """
    return ensure_aware(moment).astimezone(local_zone()).replace(tzinfo=None)


def from_local_naive(wall: datetime) -> datetime:
    """The instant (aware, UTC) at which the wall clock on this machine shows `wall`."""
    return wall.astimezone(UTC)


def utc_iso(moment: datetime) -> str:
    return ensure_aware(moment).astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")
