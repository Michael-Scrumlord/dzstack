import os
from datetime import datetime, timedelta, timezone

import pytest

from schedkit.timeutil import UTC, ensure_aware, from_local_naive, local_zone, to_local_naive, utc_iso


def test_naive_datetimes_are_taken_to_be_utc():
    assert ensure_aware(datetime(2025, 1, 15, 9, 0)) == datetime(2025, 1, 15, 9, 0, tzinfo=UTC)
    aware = datetime(2025, 1, 15, 9, 0, tzinfo=timezone(timedelta(hours=-5)))
    assert ensure_aware(aware) is aware


def test_local_zone_follows_the_tz_variable(monkeypatch):
    monkeypatch.setenv("TZ", "Asia/Kolkata")
    assert str(local_zone()) == "Asia/Kolkata"
    monkeypatch.setenv("TZ", ":Europe/Berlin")
    assert str(local_zone()) == "Europe/Berlin"
    monkeypatch.setenv("TZ", "Not/AZone")
    assert local_zone() is UTC
    monkeypatch.delenv("TZ")
    assert local_zone() is UTC


def test_midwinter_conversions_round_trip():
    # a day far from any clock change, in any zone
    instant = datetime(2025, 1, 15, 8, 0, tzinfo=UTC)
    assert from_local_naive(to_local_naive(instant)) == instant
    wall = datetime(2025, 1, 15, 9, 0)
    assert to_local_naive(from_local_naive(wall)) == wall


def test_the_local_wall_time_matches_the_zone():
    instant = datetime(2025, 7, 1, 12, 0, tzinfo=UTC)
    assert to_local_naive(instant) == instant.astimezone(local_zone()).replace(tzinfo=None)


def test_utc_iso():
    assert utc_iso(datetime(2025, 1, 15, 9, 5, 7, tzinfo=timezone(timedelta(hours=2)))) == "2025-01-15T07:05:07Z"
    assert utc_iso(datetime(2025, 1, 15, 9, 5, 7)) == "2025-01-15T09:05:07Z"
