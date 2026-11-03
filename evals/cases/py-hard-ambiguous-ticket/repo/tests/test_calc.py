from billing import api


def test_amounts_tax_and_totals(doc):
    out = api.compute(doc)
    assert [line["amount_cents"] for line in out["lines"]] == [4900, 3750]
    assert [line["tax_cents"] for line in out["lines"]] == [931, 263]  # 19% of 4900, 7% of 3750 = 262.5
    assert out["subtotal_cents"] == 8650
    assert out["tax_cents"] == 1194
    assert out["total_cents"] == 9844


def test_line_amount_is_rounded_half_up(doc):
    doc["lines"] = [{"sku": "X", "quantity": "1.5", "unit_price_cents": 101, "tax_code": "exempt"}]
    assert api.compute(doc)["lines"][0]["amount_cents"] == 152  # 151.5


def test_tax_is_rounded_per_line_not_on_the_total(doc):
    doc["lines"] = [{"sku": "X", "quantity": "1", "unit_price_cents": 150}] * 2
    out = api.compute(doc)
    assert out["tax_cents"] == 58  # 29 + 29; the tax on 300 would be 57
    assert out["total_cents"] == 358


def test_the_computed_form_has_the_documented_fields(doc):
    out = api.compute(doc)
    assert out["number"] is None
    assert out["customer"] == {"name": "Acme GmbH", "country": "DE", "email": "ap@example.com"}
    assert out["issued"] == "2026-03-02" and out["currency"] == "USD" and out["terms_days"] == 30
    assert out["lines"][0]["quantity"] == "1" and out["lines"][0]["tax_code"] == "standard"
