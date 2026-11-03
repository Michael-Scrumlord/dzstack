from decimal import Decimal

import pytest

from billing.errors import DocumentError
from billing.taxes import rate_for, tax_cents


def test_rates_by_code_and_country():
    assert rate_for("standard", "DE") == Decimal("0.19")
    assert rate_for("standard", "GB") == Decimal("0.20")
    assert rate_for("reduced", "US") == Decimal("0.0725")
    assert rate_for("exempt", "GB") == 0


def test_unknown_code():
    with pytest.raises(DocumentError, match="unknown tax code"):
        rate_for("luxury", "DE")


def test_tax_is_rounded_half_up():
    assert tax_cents(150, "standard", "DE") == 29  # 28.5
    assert tax_cents(4900, "standard", "DE") == 931
    assert tax_cents(0, "standard", "DE") == 0
