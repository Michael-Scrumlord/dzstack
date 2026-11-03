import datetime
from decimal import Decimal

import pytest

from expenses.loader import LoadError, load_expenses


def write(tmp_path, text):
    path = tmp_path / "e.csv"
    path.write_text(text, encoding="utf-8")
    return str(path)


def test_reads_rows_with_columns_in_any_order(tmp_path):
    path = write(tmp_path, "amount,date,category\n12.50,2024-03-01,Food\n")
    [e] = load_expenses(path)
    assert (e.date, e.category, e.amount) == (datetime.date(2024, 3, 1), "Food", Decimal("12.50"))


def test_quoted_commas_and_thousands_separators(tmp_path):
    path = write(tmp_path, 'date,category,description,amount\n2024-03-01,Food,"Lunch, with Sam","1,200.00"\n')
    [e] = load_expenses(path)
    assert e.category == "Food" and e.amount == Decimal("1200.00")


def test_rounds_halves_up_to_cents(tmp_path):
    path = write(tmp_path, "date,category,amount\n2024-03-01,Food,0.125\n2024-03-01,Food,-0.125\n")
    assert [e.amount for e in load_expenses(path)] == [Decimal("0.13"), Decimal("-0.13")]


def test_empty_category_is_uncategorized(tmp_path):
    path = write(tmp_path, "date,category,amount\n2024-03-01,  ,5\n")
    assert load_expenses(path)[0].category == "Uncategorized"


def test_empty_file_and_header_only_have_no_expenses(tmp_path):
    assert load_expenses(write(tmp_path, "")) == []
    assert load_expenses(write(tmp_path, "date,category,amount\n")) == []


def test_blank_lines_are_skipped(tmp_path):
    path = write(tmp_path, "date,category,amount\n\n2024-03-01,Food,5\n,,\n")
    assert len(load_expenses(path)) == 1


@pytest.mark.parametrize("text, message", [
    ("date,category\n2024-03-01,Food\n", "missing column(s): amount"),
    ("date,category,amount\n2024-03-01,Food,abc\n", "line 2: invalid amount 'abc'"),
    ("date,category,amount\n03/01/2024,Food,5\n", "line 2: invalid date '03/01/2024'"),
    ("date,category,amount\n2024-03-01,Food\n", "line 2: too few columns"),
])
def test_bad_input_is_reported(tmp_path, text, message):
    with pytest.raises(LoadError, match=message.replace("(", r"\(").replace(")", r"\)")):
        load_expenses(write(tmp_path, text))
