"""Clocks. Everything in schedkit asks a Clock for the time, so tests (and replays) can freeze it.

A clock returns an aware datetime in UTC from now().
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Protocol

UTC = timezone.utc


class Clock(Protocol):
    def now(self) -> datetime: ...


class SystemClock:
    def now(self) -> datetime:
        return datetime.now(UTC)


class ManualClock:
    """A clock that only moves when told to. Starts at `start` (aware; converted to UTC)."""

    def __init__(self, start: datetime):
        if start.tzinfo is None or start.utcoffset() is None:
            raise ValueError("ManualClock needs an aware datetime")
        self._now = start.astimezone(UTC)

    def now(self) -> datetime:
        return self._now

    def advance(self, delta: timedelta) -> datetime:
        if delta < timedelta(0):
            raise ValueError("a clock does not run backwards; use set()")
        self._now += delta
        return self._now

    def set(self, moment: datetime) -> datetime:
        if moment.tzinfo is None or moment.utcoffset() is None:
            raise ValueError("ManualClock needs an aware datetime")
        self._now = moment.astimezone(UTC)
        return self._now
