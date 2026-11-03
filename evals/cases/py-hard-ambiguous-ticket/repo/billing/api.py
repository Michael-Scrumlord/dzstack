"""The package's front door: documents in, computed invoices and rendered text out."""
from __future__ import annotations

from . import calc
from .document import parse_invoice
from .errors import BillingError
from .render_html import render_html
from .render_text import render_text

RENDERERS = {"text": render_text, "html": render_html}


def compute(doc) -> dict:
    """Validate a document and return its computed form (docs/invoice-format.md)."""
    return calc.compute(parse_invoice(doc)).to_dict()


def render_stored(data: dict, fmt: str = "text") -> str:
    """Render an already computed (or stored) invoice without recomputing anything."""
    if fmt not in RENDERERS:
        raise BillingError(f"unknown format {fmt!r} (expected one of {', '.join(RENDERERS)})")
    return RENDERERS[fmt](data)


def render(doc, fmt: str = "text") -> str:
    return render_stored(compute(doc), fmt)
