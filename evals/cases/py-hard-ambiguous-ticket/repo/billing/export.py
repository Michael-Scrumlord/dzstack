"""CSV export for the ledger (ADR-0005). The columns are a contract with finance's importer."""
from __future__ import annotations

import csv
import io
from typing import Iterable

from .money import plain_amount

COLUMNS = ["number", "issued", "customer", "currency", "subtotal", "tax", "total"]


def export_csv(invoices: Iterable[dict]) -> str:
    out = io.StringIO()
    writer = csv.writer(out, lineterminator="\n")
    writer.writerow(COLUMNS)
    for data in sorted(invoices, key=lambda d: d["number"]):
        subtotal = data["subtotal_cents"]
        tax = data["tax_cents"]
        total = subtotal + tax
        writer.writerow(
            [data["number"], data["issued"], data["customer"]["name"], data["currency"],
             plain_amount(subtotal), plain_amount(tax), plain_amount(total)]
        )
    return out.getvalue()
