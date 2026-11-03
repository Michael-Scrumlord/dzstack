from datetime import date

from billing.aging import aging, bucket_for, render_aging
from billing.statement import render_statement, statement
from billing.store import Store


def issue(store, doc, issued, customer="Acme GmbH", terms=30):
    return store.issue({**doc, "issued": issued, "terms_days": terms, "customer": {**doc["customer"], "name": customer}})


def test_buckets():
    assert [bucket_for(d) for d in (-5, 0, 1, 30, 31, 60, 61, 90, 91, 400)] == [
        "current", "current", "1-30", "1-30", "31-60", "31-60", "61-90", "61-90", "90+", "90+"]


def test_aging_totals_by_customer_and_bucket(tmp_path, doc):
    store = Store(tmp_path)
    issue(store, doc, "2026-01-01")  # due 01-31: 48 days overdue on 03-20
    issue(store, doc, "2026-03-01")  # due 03-31: current
    issue(store, doc, "2025-10-01", customer="Beta Ltd")  # long overdue
    table = aging(store.all(), paid=set(), today=date(2026, 3, 20))
    assert table["Acme GmbH"]["31-60"] == 9844 and table["Acme GmbH"]["current"] == 9844
    assert table["Beta Ltd"]["90+"] == 9844
    assert table["*"]["90+"] == 9844 and sum(table["*"].values()) == 3 * 9844
    paid = aging(store.all(), paid={"2026-0001"}, today=date(2026, 3, 20))
    assert paid["Acme GmbH"]["31-60"] == 0
    text = render_aging(table)
    assert text.splitlines()[0].startswith("Customer") and "All customers" in text.splitlines()[-1]


def test_statement_keeps_a_running_open_balance(tmp_path, doc):
    store = Store(tmp_path)
    issue(store, doc, "2026-01-01")
    issue(store, doc, "2026-02-01", customer="Beta Ltd")
    issue(store, doc, "2026-03-01")
    rows = statement(store.all(), "Acme GmbH", paid={"2026-0001"})
    assert [(r["number"], r["paid"], r["balance_cents"]) for r in rows] == [("2026-0001", True, 0), ("2026-0003", False, 9844)]
    text = render_statement("Acme GmbH", rows)
    assert text.splitlines()[0] == "Statement for Acme GmbH" and "yes" in text
    assert "(no invoices)" in render_statement("Nobody", [])
