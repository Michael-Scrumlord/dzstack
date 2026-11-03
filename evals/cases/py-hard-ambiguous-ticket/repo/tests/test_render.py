from billing import api


def test_text_invoice(doc):
    text = api.render(doc)
    lines = text.splitlines()
    assert lines[0].startswith("INVOICE (draft)") and lines[0].endswith("Issued 2026-03-02")
    assert lines[1] == "Acme GmbH (DE)" and lines[2] == "ap@acme.example"
    assert all(len(line) <= 72 for line in lines)
    assert any(line.startswith("SUB-PRO") and line.endswith("$49.00") for line in lines)
    totals = [line for line in lines if line.startswith(" " * 36)]
    assert [line.split()[0] for line in totals] == ["Subtotal", "Tax", "TOTAL"]
    assert totals[2].endswith("$98.44")
    assert lines[-2] == "Payment due within 30 days of the invoice date."
    assert lines[-1] == "Notes: PO 77"


def test_long_text_is_cut_with_an_ellipsis(doc):
    doc["lines"][0]["description"] = "A description that is much longer than its column"
    text = api.render(doc)
    assert "A description that is muc…" in text


def test_html_invoice_escapes_what_the_document_says(doc):
    doc["customer"]["name"] = "Fish & Chips <Ltd>"
    doc["lines"][0]["description"] = "<script>alert(1)</script>"
    html = api.render(doc, "html")
    assert "Fish &amp; Chips &lt;Ltd&gt;" in html
    assert "&lt;script&gt;" in html and "<script>" not in html
    assert '<tr class="total"><th colspan="4">Total</th><td class="num">$98.44</td></tr>' in html


def test_unknown_format(doc):
    import pytest

    from billing.errors import BillingError

    with pytest.raises(BillingError, match="unknown format"):
        api.render(doc, "pdf")
