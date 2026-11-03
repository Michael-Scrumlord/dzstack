import datetime
from decimal import Decimal

from expenses.loader import Expense
from expenses.report import summarize


def exp(category, amount, date="2024-03-01"):
    return Expense(datetime.date.fromisoformat(date), category, Decimal(amount))


SAMPLE = [exp("Rent", "1200.00"), exp("Food", "30.00"), exp("Food", "12.50"), exp("Fun", "42.50")]


def test_groups_and_totals():
    s = summarize(SAMPLE)
    assert [(c.category, c.count, c.total) for c in s.categories] == [
        ("Rent", 1, Decimal("1200.00")),
        ("Food", 2, Decimal("42.50")),
        ("Fun", 1, Decimal("42.50")),
    ]
    assert s.count == 4 and s.total == Decimal("1285.00")


def test_equal_totals_are_listed_by_name():
    s = summarize([exp("b", "5"), exp("a", "5")])
    assert [c.category for c in s.categories] == ["a", "b"]


def test_sort_by_name_ignores_case():
    s = summarize([exp("banana", "1"), exp("Cherry", "9"), exp("apple", "5")], sort="name")
    assert [c.category for c in s.categories] == ["apple", "banana", "Cherry"]


def test_refunds_reduce_the_total():
    s = summarize([exp("Shop", "20.00"), exp("Shop", "-5.50")])
    assert s.categories[0].total == Decimal("14.50") and s.total == Decimal("14.50")


def test_month_filter():
    s = summarize([exp("A", "1", "2024-03-31"), exp("A", "2", "2024-04-01")], month="2024-04")
    assert s.count == 1 and s.total == Decimal("2")


def test_nothing_selected():
    s = summarize([exp("A", "1")], month="2030-01")
    assert s.categories == [] and s.count == 0 and s.total == Decimal("0")
