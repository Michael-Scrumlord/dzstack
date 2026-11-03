from datetime import date

import pytest

from billing.installments import add_months, plan


def test_add_months_clamps_to_the_end_of_the_month():
    assert add_months(date(2026, 1, 31), 1) == date(2026, 2, 28)
    assert add_months(date(2026, 11, 15), 3) == date(2027, 2, 15)
    assert add_months(date(2024, 1, 31), 1) == date(2024, 2, 29)


def test_plan_splits_the_total():
    rows = plan(100000, 3, date(2026, 4, 30))
    assert [r["amount_cents"] for r in rows] == [33334, 33333, 33333]
    assert [r["due"] for r in rows] == ["2026-04-30", "2026-05-30", "2026-06-30"]


def test_plan_limits():
    for parts in (0, 25):
        with pytest.raises(ValueError):
            plan(100, parts, date(2026, 1, 1))
