import copy
from datetime import date
from decimal import Decimal

import pytest

from billing.document import parse_invoice
from billing.errors import DocumentError


def test_parses_a_valid_document(doc):
    invoice = parse_invoice(doc)
    assert invoice.customer.name == "Acme GmbH"
    assert invoice.issued == date(2026, 3, 2)
    assert invoice.currency == "USD" and invoice.terms_days == 30 and invoice.number is None
    assert [line.quantity for line in invoice.lines] == [Decimal("1"), Decimal("3")]
    assert [line.tax_code for line in invoice.lines] == ["standard", "reduced"]


@pytest.mark.parametrize(
    "change, message",
    [
        (lambda d: d.update(extra=1), "unknown field 'extra'"),
        (lambda d: d.pop("issued"), "missing field 'issued'"),
        (lambda d: d.update(issued="2026-13-01"), "issued must be a date"),
        (lambda d: d.update(currency="JPY"), "currency must be one of"),
        (lambda d: d.update(lines=[]), "non-empty list"),
        (lambda d: d.update(terms_days=-1), "terms_days must be at least 0"),
        (lambda d: d.update(terms_days=True), "terms_days must be a whole number"),
        (lambda d: d["customer"].update(country="de"), "two-letter upper-case"),
        (lambda d: d["customer"].pop("name"), "missing field 'name'"),
        (lambda d: d["lines"][0].update(quantity=2), "decimal string"),
        (lambda d: d["lines"][0].update(quantity="0"), "greater than zero"),
        (lambda d: d["lines"][0].update(unit_price_cents=12.5), "whole number"),
        (lambda d: d["lines"][0].update(unit_price_cents=-1), "at least 0"),
        (lambda d: d["lines"][1].update(tax_code="luxury"), r"lines\[1\].tax_code"),
        (lambda d: d["lines"][0].update(bogus=1), "unknown field 'bogus'"),
        (lambda d: d.update(notes="x" * 501), "at most 500"),
    ],
)
def test_invalid_documents(doc, change, message):
    change(doc)
    with pytest.raises(DocumentError, match=message):
        parse_invoice(doc)


def test_not_an_object():
    with pytest.raises(DocumentError, match="invoice must be an object"):
        parse_invoice([])


def test_parsing_does_not_change_the_document(doc):
    before = copy.deepcopy(doc)
    parse_invoice(doc)
    assert doc == before
