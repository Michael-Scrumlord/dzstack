from datetime import datetime, timedelta, timezone

import pytest

from schedkit.clock import UTC, ManualClock, SystemClock


def test_manual_clock_starts_where_told_and_reports_utc():
    clock = ManualClock(datetime(2025, 1, 15, 9, 0, tzinfo=timezone(timedelta(hours=2))))
    assert clock.now() == datetime(2025, 1, 15, 7, 0, tzinfo=UTC)
    assert clock.now().tzinfo is UTC


def test_advance_and_set():
    clock = ManualClock(datetime(2025, 1, 15, tzinfo=UTC))
    assert clock.advance(timedelta(minutes=90)) == datetime(2025, 1, 15, 1, 30, tzinfo=UTC)
    assert clock.set(datetime(2025, 2, 1, tzinfo=UTC)) == datetime(2025, 2, 1, tzinfo=UTC)
    with pytest.raises(ValueError, match="backwards"):
        clock.advance(timedelta(seconds=-1))


def test_naive_datetimes_are_refused():
    with pytest.raises(ValueError, match="aware"):
        ManualClock(datetime(2025, 1, 15))
    with pytest.raises(ValueError, match="aware"):
        ManualClock(datetime(2025, 1, 15, tzinfo=UTC)).set(datetime(2025, 1, 16))


def test_system_clock_is_aware_utc():
    assert SystemClock().now().utcoffset() == timedelta(0)
