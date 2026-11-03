from datetime import date

from billing.reminders import due_date, overdue, reminder_text
from billing.store import Store


def issue(store, doc, issued, terms=30):
    doc = {**doc, "issued": issued, "terms_days": terms}
    return store.issue(doc)


def test_due_date_and_overdue(tmp_path, doc):
    store = Store(tmp_path)
    a = issue(store, doc, "2026-01-10")  # due 2026-02-09
    b = issue(store, doc, "2026-03-01", terms=14)  # due 2026-03-15
    c = issue(store, doc, "2026-02-20")  # due 2026-03-22
    data = store.all()
    assert due_date(data[0]) == date(2026, 2, 9)
    found = overdue(data, paid=set(), today=date(2026, 3, 20))
    assert [e["number"] for e in found] == [a, b]
    assert found[0]["days_overdue"] == 39 and found[1]["amount_cents"] == 9844
    assert [e["number"] for e in overdue(data, paid={a}, today=date(2026, 3, 20))] == [b]
    assert c not in [e["number"] for e in found]


def test_nothing_is_overdue_on_the_due_date(tmp_path, doc):
    store = Store(tmp_path)
    issue(store, doc, "2026-03-01", terms=10)
    assert overdue(store.all(), set(), date(2026, 3, 11)) == []
    assert len(overdue(store.all(), set(), date(2026, 3, 12))) == 1


def test_reminder_text(tmp_path, doc):
    store = Store(tmp_path)
    issue(store, doc, "2026-03-01", terms=10)
    (entry,) = overdue(store.all(), set(), date(2026, 3, 12))
    assert reminder_text(entry) == (
        "Dear Acme GmbH, invoice 2026-0001 for $98.44 was due on 2026-03-11 and is 1 day overdue. "
        "Please pay at your earliest convenience."
    )
