import json

import pytest

from billing import api
from billing.errors import StoreError
from billing.store import Store


def test_issue_assigns_numbers_per_year_and_writes_the_computed_form(tmp_path, doc):
    store = Store(tmp_path)
    assert store.issue(doc) == "2026-0001"
    assert store.issue(doc) == "2026-0002"
    doc["issued"] = "2027-01-05"
    assert store.issue(doc) == "2027-0001"
    saved = json.loads((tmp_path / "invoices" / "2026-0001.json").read_text())
    assert saved["format_version"] == 1 and saved["number"] == "2026-0001"
    assert saved["total_cents"] == 9844
    assert store.numbers() == ["2026-0001", "2026-0002", "2027-0001"]


def test_show_reprints_from_the_file(tmp_path, doc):
    store = Store(tmp_path)
    number = store.issue(doc)
    assert store.show(number).splitlines()[0].startswith("INVOICE 2026-0001")
    path = tmp_path / "invoices" / f"{number}.json"
    data = json.loads(path.read_text())
    data["total_cents"] = 1  # what is on file is what is printed
    path.write_text(json.dumps(data))
    assert "$0.01" in store.show(number)


def test_missing_invoice(tmp_path):
    with pytest.raises(StoreError, match="no invoice 2026-0009"):
        Store(tmp_path).load("2026-0009")


def test_an_invalid_document_is_not_stored(tmp_path, doc):
    doc["lines"] = []
    with pytest.raises(Exception):
        Store(tmp_path).issue(doc)
    assert Store(tmp_path).numbers() == []
