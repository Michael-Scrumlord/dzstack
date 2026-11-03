"""Money helpers. Amounts are whole cents everywhere (ADR-0001); fractions exist only inside a calculation."""
from __future__ import annotations

from decimal import ROUND_HALF_UP, Decimal, InvalidOperation

from .errors import DocumentError

SYMBOLS = {"USD": "$", "EUR": "€", "GBP": "£"}
CURRENCIES = tuple(SYMBOLS)


def round_cents(value) -> int:
    """Round a possibly fractional number of cents to whole cents, ties away from zero (ADR-0002).

    Every rounding in this package goes through here. Python's round() and Decimal's default
    context both round ties to even, which is a cent off from the ledger on every .5.
    """
    return int(Decimal(value).quantize(Decimal(1), rounding=ROUND_HALF_UP))


def format_cents(cents: int, currency: str = "USD") -> str:
    """12345 -> '$123.45', -50 -> '-$0.50'. Used wherever a person reads an amount."""
    sign = "-" if cents < 0 else ""
    whole, frac = divmod(abs(cents), 100)
    return f"{sign}{SYMBOLS[currency]}{whole:,}.{frac:02d}"


def plain_amount(cents: int) -> str:
    """12345 -> '123.45', no symbol and no separators: the form the CSV export and the ledger use."""
    sign = "-" if cents < 0 else ""
    whole, frac = divmod(abs(cents), 100)
    return f"{sign}{whole}.{frac:02d}"


def parse_decimal(value, field: str) -> Decimal:
    """A Decimal from a string such as "2.5". JSON numbers are refused: a float cannot hold 0.1 exactly."""
    if not isinstance(value, str):
        raise DocumentError(f'{field} must be a decimal string such as "2.5", not a JSON number')
    try:
        number = Decimal(value.strip())
    except InvalidOperation:
        raise DocumentError(f"{field} is not a decimal number: {value!r}") from None
    if not number.is_finite():
        raise DocumentError(f"{field} must be a finite number")
    return number


def split_even(total: int, parts: int) -> list[int]:
    """Split cents into `parts` shares that add up to `total`; the first shares take the leftover cents."""
    if parts < 1:
        raise ValueError("parts must be at least 1")
    base, extra = divmod(total, parts)
    return [base + (1 if i < extra else 0) for i in range(parts)]
