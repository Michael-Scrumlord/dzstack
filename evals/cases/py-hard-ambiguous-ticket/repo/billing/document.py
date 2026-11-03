"""Parse and validate an invoice document (docs/invoice-format.md). Strict: unknown fields are errors."""
from __future__ import annotations

from datetime import date

from .errors import DocumentError
from .models import Customer, Invoice, Line
from .money import CURRENCIES, parse_decimal
from .taxes import TAX_CODES

TOP_KEYS = {"number", "customer", "currency", "issued", "terms_days", "notes", "lines"}
CUSTOMER_KEYS = {"name", "country", "email"}
LINE_KEYS = {"sku", "description", "quantity", "unit_price_cents", "tax_code"}
MAX_LINES = 200


def _object(value, where: str, allowed: set[str], required: set[str]) -> dict:
    if not isinstance(value, dict):
        raise DocumentError(f"{where} must be an object")
    unknown = sorted(set(value) - allowed)
    if unknown:
        raise DocumentError(f"{where}: unknown field {unknown[0]!r}")
    missing = sorted(required - set(value))
    if missing:
        raise DocumentError(f"{where}: missing field {missing[0]!r}")
    return value


def _text(value, where: str, *, max_length: int, blank_ok: bool = False) -> str:
    if not isinstance(value, str):
        raise DocumentError(f"{where} must be a string")
    if not blank_ok and not value.strip():
        raise DocumentError(f"{where} must not be empty")
    if len(value) > max_length:
        raise DocumentError(f"{where} must be at most {max_length} characters")
    return value


def _whole(value, where: str, *, minimum: int) -> int:
    if isinstance(value, bool) or not isinstance(value, int):
        raise DocumentError(f"{where} must be a whole number")
    if value < minimum:
        raise DocumentError(f"{where} must be at least {minimum}")
    return value


def _customer(raw) -> Customer:
    raw = _object(raw, "customer", CUSTOMER_KEYS, {"name", "country"})
    country = _text(raw["country"], "customer.country", max_length=2)
    if len(country) != 2 or not country.isalpha() or not country.isupper():
        raise DocumentError("customer.country must be a two-letter upper-case code such as 'DE'")
    email = raw.get("email")
    if email is not None:
        email = _text(email, "customer.email", max_length=120)
    return Customer(_text(raw["name"], "customer.name", max_length=80), country, email)


def _line(raw, index: int) -> Line:
    where = f"lines[{index}]"
    raw = _object(raw, where, LINE_KEYS, {"sku", "quantity", "unit_price_cents"})
    quantity = parse_decimal(raw["quantity"], f"{where}.quantity")
    if quantity <= 0:
        raise DocumentError(f"{where}.quantity must be greater than zero")
    code = raw.get("tax_code", "standard")
    if code not in TAX_CODES:
        raise DocumentError(f"{where}.tax_code must be one of {', '.join(TAX_CODES)}")
    return Line(
        sku=_text(raw["sku"], f"{where}.sku", max_length=32),
        description=_text(raw.get("description", ""), f"{where}.description", max_length=120, blank_ok=True),
        quantity=quantity,
        unit_price_cents=_whole(raw["unit_price_cents"], f"{where}.unit_price_cents", minimum=0),
        tax_code=code,
    )


def parse_invoice(doc) -> Invoice:
    """Validate a document (the dict a JSON file holds) and return the Invoice it describes."""
    doc = _object(doc, "invoice", TOP_KEYS, {"customer", "issued", "lines"})
    try:
        issued = date.fromisoformat(_text(doc["issued"], "issued", max_length=10))
    except ValueError:
        raise DocumentError("issued must be a date such as 2026-03-02") from None
    currency = doc.get("currency", "USD")
    if currency not in CURRENCIES:
        raise DocumentError(f"currency must be one of {', '.join(CURRENCIES)}")
    lines = doc["lines"]
    if not isinstance(lines, list) or not lines:
        raise DocumentError("lines must be a non-empty list")
    if len(lines) > MAX_LINES:
        raise DocumentError(f"an invoice has at most {MAX_LINES} lines")
    number = doc.get("number")
    if number is not None:
        number = _text(number, "number", max_length=20)
    return Invoice(
        customer=_customer(doc["customer"]),
        issued=issued,
        lines=tuple(_line(raw, i) for i, raw in enumerate(lines)),
        currency=currency,
        number=number,
        terms_days=_whole(doc.get("terms_days", 30), "terms_days", minimum=0),
        notes=_text(doc.get("notes", ""), "notes", max_length=500, blank_ok=True),
    )


