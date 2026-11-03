from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

import pytest

from reportly.formatting import display, machine


@pytest.mark.parametrize(
    "value, shown",
    [
        (None, "-"),
        (True, "yes"),
        (False, "no"),
        (1234567, "1,234,567"),
        (-5, "-5"),
        (1234.5, "1,234.50"),
        (Decimal("0.5"), "0.50"),
        (date(2025, 3, 9), "2025-03-09"),
        (datetime(2025, 3, 9, 14, 30, 59), "2025-03-09 14:30"),
        ("plain", "plain"),
        ("two\nlines", "two lines"),
        ("windows\r\nlines", "windows lines"),
    ],
)
def test_display(value, shown):
    assert display(value) == shown


@pytest.mark.parametrize(
    "value, written",
    [
        (None, ""),
        (True, "true"),
        (False, "false"),
        (1234567, "1234567"),
        (-5, "-5"),
        (1234.5, "1234.5"),
        (3.0, "3.0"),
        (1e-07, "1e-07"),
        (Decimal("1234.50"), "1234.50"),
        (Decimal("-0.50"), "-0.50"),
        (Decimal("1E+3"), "1000"),
        (date(2025, 3, 9), "2025-03-09"),
        (datetime(2025, 3, 9, 14, 30, 59), "2025-03-09T14:30:59"),
        (datetime(2025, 3, 9, 14, 30, 59, 250000, tzinfo=timezone(timedelta(hours=-5))), "2025-03-09T14:30:59.250000-05:00"),
        ("two\nlines", "two\nlines"),
        ("=1+1", "=1+1"),
    ],
)
def test_machine(value, written):
    assert machine(value) == written
