from datetime import date

import pytest

from reportly.util.dates import iso_week, month_end, month_start, parse_relative
from reportly.util.text import indent, plural, truncate
from reportly.util.units import humanize_bytes, humanize_seconds


def test_truncate():
    assert truncate("abcdef", 0) == "abcdef"
    assert truncate("abcdef", 6) == "abcdef"
    assert truncate("abcdefg", 6) == "abc..."
    assert truncate("abcdefg", 3) == "abc"


def test_plural_and_indent():
    assert plural(1, "row") == "1 row"
    assert plural(2, "row") == "2 rows"
    assert plural(0, "category", "categories") == "0 categories"
    assert indent("a\n\nb") == "  a\n\n  b"


def test_relative_dates():
    today = date(2025, 3, 9)
    assert parse_relative("today", today) == today
    assert parse_relative("yesterday", today) == date(2025, 3, 8)
    assert parse_relative("-7d", today) == date(2025, 3, 2)
    assert parse_relative("+2w", today) == date(2025, 3, 23)
    assert parse_relative("2024-12-31", today) == date(2024, 12, 31)
    with pytest.raises(ValueError):
        parse_relative("sometime", today)


def test_month_helpers():
    assert month_start(date(2025, 2, 17)) == date(2025, 2, 1)
    assert month_end(date(2025, 2, 17)) == date(2025, 2, 28)
    assert month_end(date(2024, 2, 1)) == date(2024, 2, 29)
    assert month_end(date(2025, 12, 5)) == date(2025, 12, 31)
    assert iso_week(date(2025, 3, 9)) == "2025-W10"


def test_humanize():
    assert humanize_bytes(512) == "512 B"
    assert humanize_bytes(1536) == "1.5 KB"
    assert humanize_bytes(5 * 1024**3) == "5.0 GB"
    assert humanize_seconds(0.25) == "250 ms"
    assert humanize_seconds(12.34) == "12.3 s"
    assert humanize_seconds(125) == "2 min 5 s"
