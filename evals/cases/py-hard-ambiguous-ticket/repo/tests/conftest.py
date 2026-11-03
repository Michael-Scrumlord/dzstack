import copy

import pytest


@pytest.fixture
def doc():
    """A small valid document: two lines, two tax codes, a customer in Germany."""
    return copy.deepcopy(
        {
            "customer": {"name": "Acme GmbH", "country": "DE", "email": "ap@example.com"},
            "issued": "2026-03-02",
            "notes": "PO 77",
            "lines": [
                {"sku": "SUB-PRO", "description": "Pro plan, March", "quantity": "1", "unit_price_cents": 4900},
                {"sku": "SEAT", "description": "Extra seat", "quantity": "3", "unit_price_cents": 1250, "tax_code": "reduced"},
            ],
        }
    )
