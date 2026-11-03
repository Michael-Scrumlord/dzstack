"""The invoice document as objects, and the computed result."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from decimal import Decimal


@dataclass(frozen=True)
class Customer:
    name: str
    country: str
    email: str | None = None


@dataclass(frozen=True)
class Line:
    sku: str
    description: str
    quantity: Decimal
    unit_price_cents: int
    tax_code: str = "standard"


@dataclass(frozen=True)
class Invoice:
    customer: Customer
    issued: date
    lines: tuple[Line, ...]
    currency: str = "USD"
    number: str | None = None
    terms_days: int = 30
    notes: str = ""


@dataclass(frozen=True)
class ComputedLine:
    line: Line
    amount_cents: int
    tax_cents: int

    def to_dict(self) -> dict:
        return {
            "sku": self.line.sku,
            "description": self.line.description,
            "quantity": format(self.line.quantity, "f"),
            "unit_price_cents": self.line.unit_price_cents,
            "tax_code": self.line.tax_code,
            "amount_cents": self.amount_cents,
            "tax_cents": self.tax_cents,
        }


@dataclass(frozen=True)
class ComputedInvoice:
    invoice: Invoice
    lines: tuple[ComputedLine, ...]
    subtotal_cents: int
    tax_cents: int
    total_cents: int

    def to_dict(self) -> dict:
        inv = self.invoice
        customer = {"name": inv.customer.name, "country": inv.customer.country}
        if inv.customer.email:
            customer["email"] = inv.customer.email
        return {
            "number": inv.number,
            "customer": customer,
            "currency": inv.currency,
            "issued": inv.issued.isoformat(),
            "terms_days": inv.terms_days,
            "notes": inv.notes,
            "lines": [line.to_dict() for line in self.lines],
            "subtotal_cents": self.subtotal_cents,
            "tax_cents": self.tax_cents,
            "total_cents": self.total_cents,
        }
