"""Tax rates by tax code and customer country (ADR-0003: tax is computed per line)."""
from __future__ import annotations

from decimal import Decimal

from .errors import DocumentError
from .money import round_cents

BASE_RATES = {"standard": Decimal("0.19"), "reduced": Decimal("0.07"), "exempt": Decimal("0")}
COUNTRY_RATES = {
    ("standard", "GB"): Decimal("0.20"),
    ("reduced", "GB"): Decimal("0.05"),
    ("standard", "US"): Decimal("0.0725"),
    ("reduced", "US"): Decimal("0.0725"),
}
TAX_CODES = tuple(BASE_RATES)


def rate_for(code: str, country: str) -> Decimal:
    if code not in BASE_RATES:
        raise DocumentError(f"unknown tax code {code!r} (expected one of {', '.join(TAX_CODES)})")
    return COUNTRY_RATES.get((code, country), BASE_RATES[code])


def tax_cents(net_cents: int, code: str, country: str) -> int:
    """Tax on one line's net amount, rounded to whole cents."""
    return round_cents(Decimal(net_cents) * rate_for(code, country))
