from decimal import Decimal

import pytest

from billing.errors import DocumentError
from billing.money import format_cents, parse_decimal, plain_amount, round_cents, split_even


@pytest.mark.parametrize(
    "value, expected",
    [("2.5", 3), ("2.4", 2), ("154.5", 155), ("-2.5", -3), ("-2.4", -2), ("0.5", 1), (Decimal("1.49999"), 1), (7, 7)],
)
def test_round_cents_rounds_ties_away_from_zero(value, expected):
    assert round_cents(value) == expected


def test_format_cents():
    assert format_cents(4900) == "$49.00"
    assert format_cents(123456789, "EUR") == "€1,234,567.89"
    assert format_cents(-50) == "-$0.50"
    assert format_cents(0, "GBP") == "£0.00"


def test_plain_amount():
    assert plain_amount(4900) == "49.00"
    assert plain_amount(5) == "0.05"
    assert plain_amount(-1234) == "-12.34"


def test_parse_decimal_takes_strings_only():
    assert parse_decimal(" 2.50 ", "q") == Decimal("2.50")
    for bad in (2.5, 2, None, True):
        with pytest.raises(DocumentError, match="decimal string"):
            parse_decimal(bad, "q")
    for bad in ("abc", "", "NaN", "Infinity"):
        with pytest.raises(DocumentError):
            parse_decimal(bad, "q")


def test_split_even_gives_the_leftover_cents_to_the_first_shares():
    assert split_even(100, 3) == [34, 33, 33]
    assert split_even(9, 3) == [3, 3, 3]
    assert sum(split_even(12345, 7)) == 12345
    with pytest.raises(ValueError):
        split_even(100, 0)
