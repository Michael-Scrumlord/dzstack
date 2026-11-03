import csv
import io

from billing.export import COLUMNS, export_csv
from billing.store import Store


def rows(text):
    return list(csv.DictReader(io.StringIO(text)))


def test_header_is_the_contract(tmp_path, doc):
    assert COLUMNS == ["number", "issued", "customer", "currency", "subtotal", "tax", "total"]
    assert export_csv([]).splitlines() == [",".join(COLUMNS)]


def test_one_row_per_invoice(tmp_path, doc):
    store = Store(tmp_path)
    store.issue(doc)
    doc["customer"]["name"] = "Beta, Inc."
    store.issue(doc)
    out = rows(export_csv(store.all()))
    assert [r["number"] for r in out] == ["2026-0001", "2026-0002"]
    assert out[0] == {"number": "2026-0001", "issued": "2026-03-02", "customer": "Acme GmbH", "currency": "USD",
                      "subtotal": "86.50", "tax": "11.94", "total": "98.44"}
    assert out[1]["customer"] == "Beta, Inc."


def test_subtotal_plus_tax_is_total(tmp_path, doc):
    store = Store(tmp_path)
    store.issue(doc)
    (row,) = rows(export_csv(store.all()))
    assert round(float(row["subtotal"]) + float(row["tax"]), 2) == float(row["total"])
