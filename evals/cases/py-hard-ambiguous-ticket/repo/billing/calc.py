"""Compute an invoice's amounts. Everything is whole cents; every rounding is money.round_cents."""
from __future__ import annotations

from .models import ComputedInvoice, ComputedLine, Invoice
from .money import round_cents
from .taxes import tax_cents


def compute(invoice: Invoice) -> ComputedInvoice:
    lines = []
    for line in invoice.lines:
        amount = round_cents(line.quantity * line.unit_price_cents)
        tax = tax_cents(amount, line.tax_code, invoice.customer.country)
        lines.append(ComputedLine(line, amount, tax))
    subtotal = sum(line.amount_cents for line in lines)
    tax = sum(line.tax_cents for line in lines)
    return ComputedInvoice(invoice, tuple(lines), subtotal, tax, subtotal + tax)
