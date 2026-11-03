"""Hidden checks for invoice discounts. Everything here follows from docs/ (product notes, ADR-0006, glossary,
invoice-format, rendering, ADR-0002/0004/0005) or from the code. How a fixed discount is spread over several lines
is NOT settled by the docs, so no check depends on it: fixed discounts are checked on one line, on tax-exempt
lines (where the split cannot change any figure but the per-line ones), as the last discount, or through
invariants that hold for any split."""
import copy
import csv
import io
import json
import os
import random
import re
import shutil
import sys
from decimal import ROUND_HALF_UP, Decimal
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
HIDDEN = Path(os.environ.get("HIDDEN_DIR", "/hidden"))

from billing import api  # noqa: E402
from billing.cli import main  # noqa: E402
from billing.errors import DocumentError  # noqa: E402
from billing.export import export_csv  # noqa: E402
from billing.money import format_cents  # noqa: E402
from billing.store import Store  # noqa: E402

RATES = {"standard": Decimal("0.19"), "reduced": Decimal("0.07"), "exempt": Decimal("0")}  # Germany, taxes.py


def half_up(x) -> int:
    return int(Decimal(x).quantize(Decimal(1), rounding=ROUND_HALF_UP))


def line(cents, tax="standard", qty="1", sku="L"):
    return {"sku": sku, "description": f"{sku} item", "quantity": qty, "unit_price_cents": cents, "tax_code": tax}


def pct(label, value):
    return {"label": label, "kind": "percent", "percent": value}


def fixed(label, cents):
    return {"label": label, "kind": "fixed", "amount_cents": cents}


def make(lines, discounts=None, country="DE", **extra):
    d = {"customer": {"name": "Acme GmbH", "country": country}, "issued": "2026-03-02", "lines": lines, **extra}
    if discounts is not None:
        d["discounts"] = discounts
    return d


def figures(out):
    return (out["subtotal_cents"], out["discount_cents"], out["tax_cents"], out["total_cents"])


def check_invariants(out, country_rates=RATES):
    """What must hold for any computed invoice, however a fixed discount was spread."""
    lines = out["lines"]
    for ln in lines:
        assert 0 <= ln["discount_cents"] <= ln["amount_cents"], ln
        assert ln["net_cents"] == ln["amount_cents"] - ln["discount_cents"] >= 0, ln
        assert ln["tax_cents"] == half_up(Decimal(ln["net_cents"]) * country_rates[ln["tax_code"]]), ln
    assert out["subtotal_cents"] == sum(ln["amount_cents"] for ln in lines)
    assert out["discount_cents"] == sum(ln["discount_cents"] for ln in lines)
    assert out["discount_cents"] == sum(d["applied_cents"] for d in out["discounts"])
    assert out["tax_cents"] == sum(ln["tax_cents"] for ln in lines)
    assert out["total_cents"] == out["subtotal_cents"] - out["discount_cents"] + out["tax_cents"]
    assert out["total_cents"] >= 0
    remaining = out["subtotal_cents"]
    for d in out["discounts"]:
        assert 0 <= d["applied_cents"] <= remaining
        if d["kind"] == "fixed":
            assert d["applied_cents"] == min(d["amount_cents"], remaining), d
        remaining -= d["applied_cents"]
    assert remaining == sum(ln["net_cents"] for ln in lines)


# ---- the figures ----

def test_percent_discount_comes_off_before_tax():
    out = api.compute(make([line(10000)], [pct("Loyalty", "10")]))
    assert figures(out) == (10000, 1000, 1710, 10710)  # tax on 9000, not on 10000
    assert (out["lines"][0]["discount_cents"], out["lines"][0]["net_cents"], out["lines"][0]["tax_cents"]) == (1000, 9000, 1710)
    assert out["discounts"] == [{"label": "Loyalty", "kind": "percent", "percent": "10", "applied_cents": 1000}]
    check_invariants(out)


def test_tax_is_worked_out_per_line_on_each_lines_net():
    out = api.compute(make([line(10000), line(5000, "reduced"), line(2000, "exempt")], [pct("Loyalty", "20")]))
    assert [ln["net_cents"] for ln in out["lines"]] == [8000, 4000, 1600]
    assert [ln["tax_cents"] for ln in out["lines"]] == [1520, 280, 0]
    assert figures(out) == (17000, 3400, 1800, 15400)


def test_percent_discounts_are_rounded_per_line_half_up():
    out = api.compute(make([line(1030, "exempt"), line(1030, "exempt"), line(1031, "exempt")], [pct("D", "15")]))
    assert [ln["discount_cents"] for ln in out["lines"]] == [155, 155, 155]  # 154.5, 154.5, 154.65
    assert out["discount_cents"] == 465  # not 463 (ties to even) and not 464 (rounding the sum once)
    out = api.compute(make([line(1, "exempt"), line(1, "exempt"), line(1, "exempt")], [pct("D", "50")]))
    assert [ln["discount_cents"] for ln in out["lines"]] == [1, 1, 1]  # 0.5 rounds up, away from zero
    out = api.compute(make([line(333, "exempt", qty="3")], [pct("D", "7.5")]))
    assert out["lines"][0]["discount_cents"] == half_up(Decimal(999) * Decimal("0.075"))  # 74.925 -> 75


def test_tax_on_the_discounted_amount_is_rounded_half_up():
    out = api.compute(make([line(300)], [pct("Half", "50")]))
    assert out["lines"][0]["net_cents"] == 150
    assert out["lines"][0]["tax_cents"] == 29  # 28.5 rounds up
    assert out["total_cents"] == 179


def test_discounts_stack_in_the_listed_order_each_on_what_is_left():
    out = api.compute(make([line(10000, "exempt")], [pct("A", "10"), pct("B", "10")]))
    assert [d["applied_cents"] for d in out["discounts"]] == [1000, 900] and out["discount_cents"] == 1900
    out = api.compute(make([line(10000, "exempt")], [fixed("A", 1000), pct("B", "10")]))
    assert [d["applied_cents"] for d in out["discounts"]] == [1000, 900]
    out = api.compute(make([line(10000, "exempt")], [pct("B", "10"), fixed("A", 1000)]))
    assert [d["applied_cents"] for d in out["discounts"]] == [1000, 1000]
    out = api.compute(make([line(10001, "exempt")], [pct("A", "50"), pct("B", "50"), pct("C", "50")]))
    assert [d["applied_cents"] for d in out["discounts"]] == [5001, 2500, 1250]  # 5000.5 up; then 2500; then 1250
    assert out["total_cents"] == 1250
    out = api.compute(make([line(10000, "exempt")], [pct("A", "10")] * 5))
    assert out["discount_cents"] == 10000 - 5905  # 10000 -> 9000 -> 8100 -> 7290 -> 6561 -> 5905


def test_the_order_of_the_discounts_is_the_order_in_the_computed_form():
    out = api.compute(make([line(10000)], [fixed("Z last alphabetically", 100), pct("A first alphabetically", "5")]))
    assert [d["label"] for d in out["discounts"]] == ["Z last alphabetically", "A first alphabetically"]


def test_a_discount_never_takes_a_line_or_the_invoice_below_zero():
    out = api.compute(make([line(500, "exempt")], [fixed("Big", 800)]))
    assert out["discounts"][0]["applied_cents"] == 500 and out["total_cents"] == 0
    out = api.compute(make([line(4900)], [pct("Free", "100")]))
    assert (out["lines"][0]["net_cents"], out["tax_cents"], out["total_cents"]) == (0, 0, 0)
    out = api.compute(make([line(6000)], [pct("Most", "60"), fixed("Rest", 5000)]))
    assert [d["applied_cents"] for d in out["discounts"]] == [3600, 2400]
    assert (out["tax_cents"], out["total_cents"]) == (0, 0)
    out = api.compute(make([line(1500, "exempt")], [fixed("A", 1000), fixed("B", 1000), fixed("C", 1000)]))
    assert [d["applied_cents"] for d in out["discounts"]] == [1000, 500, 0] and out["total_cents"] == 0
    out = api.compute(make([line(100, "exempt"), line(200, "exempt"), line(300, "exempt")], [fixed("Huge", 10_000)]))
    assert [ln["net_cents"] for ln in out["lines"]] == [0, 0, 0] and out["total_cents"] == 0
    assert [ln["discount_cents"] for ln in out["lines"]] == [100, 200, 300]
    out = api.compute(make([line(0, "exempt")], [fixed("On nothing", 100), pct("Also nothing", "10")]))
    assert out["discount_cents"] == 0 and out["total_cents"] == 0


def test_a_fixed_discount_takes_exactly_its_amount_off_across_several_lines():
    out = api.compute(make([line(3333, "exempt"), line(3333, "exempt"), line(3334, "exempt")], [fixed("Credit", 1000)]))
    assert out["discount_cents"] == 1000 and out["total_cents"] == 9000
    assert sum(ln["discount_cents"] for ln in out["lines"]) == 1000
    check_invariants(out)
    out = api.compute(make([line(1, "exempt"), line(1, "exempt"), line(1, "exempt")], [fixed("Two cents", 2)]))
    assert out["total_cents"] == 1 and sum(ln["discount_cents"] for ln in out["lines"]) == 2
    out = api.compute(make([line(700, "exempt"), line(1100, "exempt"), line(1300, "exempt")], [fixed("Ten", 10)]))
    assert out["total_cents"] == 3100 - 10 and sum(ln["discount_cents"] for ln in out["lines"]) == 10
    check_invariants(out)


def test_a_fixed_discount_after_percent_discounts_takes_its_amount_off_what_they_left():
    out = api.compute(make([line(5000, "exempt"), line(3000, "exempt"), line(2001, "exempt")], [pct("P", "10"), fixed("F", 1234)]))
    after_percent = [4500, 2700, 1801]  # 200.1 -> 200 off the last line
    assert out["discounts"][0]["applied_cents"] == 5000 + 3000 + 2001 - sum(after_percent)
    assert out["discounts"][1]["applied_cents"] == 1234
    assert out["total_cents"] == sum(after_percent) - 1234
    check_invariants(out)


def test_figures_for_random_invoices_follow_the_documented_rules():
    rnd = random.Random(2026)
    for _ in range(400):
        lines = [line(rnd.choice([0, 1, 7, 99, 150, 1030, 4999, 12345, 50000]), rnd.choice(list(RATES)),
                      qty=rnd.choice(["1", "2", "0.5", "1.5", "3.333", "10"]), sku=f"S{i}")
                 for i in range(rnd.randint(1, 6))]
        kinds = rnd.sample(["percent", "fixed", "percent", "fixed", "percent"], rnd.randint(0, 5))
        discounts = [pct(f"P{i}", rnd.choice(["1", "5", "7.5", "10", "15", "33.333", "50", "99.99", "100"])) if k == "percent"
                     else fixed(f"F{i}", rnd.choice([1, 2, 99, 500, 2500, 100000])) for i, k in enumerate(kinds)]
        out = api.compute(make(lines, discounts))
        check_invariants(out)
        if all(d["kind"] == "percent" for d in discounts):  # per-line rounding is fully settled for percentages
            nets = [half_up(Decimal(ln["quantity"]) * ln["unit_price_cents"]) for ln in out["lines"]]
            for d in discounts:
                nets = [n - half_up(Decimal(n) * Decimal(d["percent"]) / 100) for n in nets]
            assert [ln["net_cents"] for ln in out["lines"]] == nets
        elif len({d["kind"] for d in discounts[:-1]} | {"percent"}) == 1 and discounts[-1]["kind"] == "fixed":
            nets = [half_up(Decimal(ln["quantity"]) * ln["unit_price_cents"]) for ln in out["lines"]]
            for d in discounts[:-1]:
                nets = [n - half_up(Decimal(n) * Decimal(d["percent"]) / 100) for n in nets]
            assert out["discounts"][-1]["applied_cents"] == min(discounts[-1]["amount_cents"], sum(nets))


def test_the_computed_form_always_has_the_discount_fields():
    out = api.compute(make([line(4900), line(1250, "reduced", qty="3")]))
    assert out["discounts"] == [] and out["discount_cents"] == 0
    for ln in out["lines"]:
        assert ln["discount_cents"] == 0 and ln["net_cents"] == ln["amount_cents"]
    assert api.compute(make([line(4900)], []))["discounts"] == []


# ---- the documents ----

BAD_ENTRIES = [
    pct("x", "0"), pct("x", "-5"), pct("x", "100.01"), pct("x", "abc"), pct("x", ""), pct("x", "NaN"), pct("x", "Infinity"),
    pct("x", 10), pct("x", 7.5), pct("x", True), pct("x", None), {"label": "x", "kind": "percent"},
    {"label": "x", "kind": "percent", "percent": "10", "amount_cents": 5},
    fixed("x", 0), fixed("x", -1), fixed("x", 10.5), fixed("x", "100"), fixed("x", True), fixed("x", None),
    {"label": "x", "kind": "fixed"}, {"label": "x", "kind": "fixed", "amount_cents": 5, "percent": "5"},
    {"label": "x", "kind": "bogus"}, {"label": "x", "kind": "PERCENT", "percent": "5"}, {"label": "x", "percent": "5"},
    {"kind": "fixed", "amount_cents": 5}, fixed("", 5), fixed("   ", 5), fixed("y" * 61, 5), fixed(5, 5), fixed(None, 5),
    {"label": "x", "kind": "fixed", "amount_cents": 5, "note": "extra"},
    "10%", 10, None, [], [pct("x", "5")],
]


@pytest.mark.parametrize("entry", BAD_ENTRIES, ids=lambda e: json.dumps(e)[:60])
def test_invalid_discount_entries_are_document_errors(entry):
    with pytest.raises(DocumentError):
        api.compute(make([line(1000)], [entry]))


def test_error_messages_name_the_field():
    cases = [(pct("x", "0"), "percent"), (pct("x", "abc"), "percent"), (pct("x", 10), "percent"), (fixed("x", 0), "amount_cents"),
             (fixed("x", 1.5), "amount_cents"), (fixed("", 1), "label"), ({"label": "x", "kind": "bogus"}, "kind"),
             ({"label": "x", "kind": "fixed", "amount_cents": 5, "note": "e"}, "note")]
    for entry, name in cases:
        with pytest.raises(DocumentError) as err:
            api.compute(make([line(1000)], [entry]))
        assert name in str(err.value), (entry, str(err.value))


def test_valid_extremes_are_accepted():
    for entry in [pct("x", "100"), pct("x", "0.01"), pct("x", "7.5"), pct("x" * 60, "5"), fixed("x", 1), fixed("é & <b>", 10**9)]:
        check_invariants(api.compute(make([line(1000)], [entry])))
    check_invariants(api.compute(make([line(1000)], [pct(str(i), "1") for i in range(5)])))


def test_at_most_five_discounts_and_the_list_must_be_a_list():
    with pytest.raises(DocumentError, match="discounts"):
        api.compute(make([line(1000)], [pct(str(i), "1") for i in range(6)]))
    for bad in ({"label": "x", "kind": "fixed", "amount_cents": 5}, "10%", 5):
        with pytest.raises(DocumentError, match="discounts"):
            api.compute(make([line(1000)], bad))


def test_the_command_line_reports_a_bad_discount_with_status_2(tmp_path):
    path = tmp_path / "bad.json"
    path.write_text(json.dumps(make([line(1000)], [pct("x", "150")])))
    out, err = io.StringIO(), io.StringIO()
    assert main(["compute", str(path)], stdout=out, stderr=err) == 2
    assert out.getvalue() == "" and err.getvalue().startswith("error: ") and "percent" in err.getvalue()


# ---- the rendered invoice ----

def split_rows(text):
    rows = text.splitlines()
    return rows, {
        "items": [i for i, r in enumerate(rows) if r.startswith("L ") or r.startswith("S0 ")],
        "subtotal": next(i for i, r in enumerate(rows) if r.strip().startswith("Subtotal")),
        "tax": next(i for i, r in enumerate(rows) if r.strip().startswith("Tax")),
        "total": next(i for i, r in enumerate(rows) if r.strip().startswith("TOTAL")),
        "discounts": [i for i, r in enumerate(rows) if r.strip().startswith("Discount")],
    }


def test_the_printed_invoice_shows_each_discount_on_its_own_line():
    doc = make([line(10000), line(5000, "reduced", sku="S0")], [pct("Spring sale", "10"), fixed("Welcome", 500)])
    out = api.compute(doc)
    rows, at = split_rows(api.render(doc))
    assert len(at["discounts"]) == 2
    assert max(at["items"]) < at["subtotal"] < at["discounts"][0] < at["discounts"][1] < at["tax"] < at["total"]
    first, second = (rows[i] for i in at["discounts"])
    assert "Spring sale" in first and "Welcome" in second
    assert first.rstrip().endswith(format_cents(-out["discounts"][0]["applied_cents"]))
    assert second.rstrip().endswith(format_cents(-out["discounts"][1]["applied_cents"]))
    assert rows[at["subtotal"]].rstrip().endswith(format_cents(out["subtotal_cents"]))
    assert rows[at["tax"]].rstrip().endswith(format_cents(out["tax_cents"]))
    assert rows[at["total"]].rstrip().endswith(format_cents(out["total_cents"]))
    assert all(len(r) <= 72 for r in rows)


def test_a_long_label_still_fits_the_printed_invoice():
    doc = make([line(10000)], [pct("L" * 60, "10")])
    rows = api.render(doc).splitlines()
    assert all(len(r) <= 72 for r in rows)
    assert any(r.strip().startswith("Discount (") and r.rstrip().endswith("-$10.00") for r in rows)


def test_the_emailed_invoice_shows_each_discount_escaped():
    label = 'Spring <sale> & "more"'
    doc = make([line(10000)], [pct(label, "10"), fixed("Welcome", 500)])
    out = api.compute(doc)
    html = api.render(doc, "html")
    rows = re.findall(r'<tr class="discount">(.*?)</tr>', html)
    assert len(rows) == 2
    assert "Discount (Spring &lt;sale&gt; &amp; &quot;more&quot;)" in rows[0] or "Discount (Spring &lt;sale&gt; &amp; \"more\")" in rows[0]
    assert "<sale>" not in html
    assert rows[0].endswith(f'<td class="num">{format_cents(-out["discounts"][0]["applied_cents"])}</td>')
    assert "Welcome" in rows[1] and format_cents(-out["discounts"][1]["applied_cents"]) in rows[1]
    assert html.index('class="subtotal"') < html.index('class="discount"') < html.rindex('class="discount"') < html.index('class="tax"') < html.index('class="total"')
    assert f'<td class="num">{format_cents(out["subtotal_cents"])}</td>' in re.search(r'<tr class="subtotal">.*?</tr>', html).group(0)


@pytest.mark.parametrize("name", ["plain", "uk-eur", "escape", "ties"])
def test_invoices_without_discounts_look_exactly_as_before(name):
    doc = json.loads((HIDDEN / "docs" / f"{name}.json").read_text())
    assert api.render(doc) == (HIDDEN / "golden" / f"{name}.txt").read_text()
    assert api.render(doc, "html") == (HIDDEN / "golden" / f"{name}.html").read_text()
    assert api.render({**doc, "discounts": []}) == (HIDDEN / "golden" / f"{name}.txt").read_text()
    before = json.loads((HIDDEN / "golden" / f"{name}.json").read_text())
    now = api.compute(doc)
    for key, value in before.items():
        if key == "lines":
            for old_line, new_line in zip(value, now["lines"]):
                assert {k: new_line[k] for k in old_line} == old_line
                assert new_line["discount_cents"] == 0 and new_line["net_cents"] == new_line["amount_cents"]
        else:
            assert now[key] == value, key
    assert now["discounts"] == [] and now["discount_cents"] == 0


# ---- issued invoices, the store and the ledger ----

OLD = ["2025-0001", "2025-0002", "2026-0001", "2026-0002"]


def old_store(tmp_path):
    root = tmp_path / "old"
    shutil.copytree(HIDDEN / "old_store", root)
    return Store(root), root


def cli(*argv):
    out, err = io.StringIO(), io.StringIO()
    code = main(list(argv), stdout=out, stderr=err)
    assert code == 0, err.getvalue()
    return out.getvalue()


def test_invoices_stored_before_discounts_still_print_exactly_as_before(tmp_path):
    store, root = old_store(tmp_path)
    assert store.numbers() == OLD
    for number in OLD:
        assert store.show(number) == (HIDDEN / "golden" / f"show-{number}.txt").read_text()
        assert store.show(number, "html") == (HIDDEN / "golden" / f"show-{number}.html").read_text()
        assert cli("show", number, "--store", str(root)) == (HIDDEN / "golden" / f"show-{number}.txt").read_text()


def test_the_ledger_export_of_old_invoices_is_unchanged(tmp_path):
    store, root = old_store(tmp_path)
    assert export_csv(store.all()) == (HIDDEN / "golden" / "export.csv").read_text()
    assert cli("export", "--store", str(root)) == (HIDDEN / "golden" / "export.csv").read_text()


def test_reminders_aging_and_statements_of_old_invoices_are_unchanged(tmp_path):
    _, root = old_store(tmp_path)
    s = str(root)
    assert cli("remind", "--store", s, "--today", "2026-03-20", "--paid", "2025-0001") == (HIDDEN / "golden" / "remind.txt").read_text()
    assert cli("aging", "--store", s, "--today", "2026-03-20") == (HIDDEN / "golden" / "aging.txt").read_text()
    assert cli("statement", "Acme GmbH", "--store", s) == (HIDDEN / "golden" / "statement.txt").read_text()


def parse_csv(text):
    return list(csv.DictReader(io.StringIO(text)))


def test_a_discounted_invoice_is_stored_reprinted_and_exported(tmp_path):
    store, root = old_store(tmp_path)
    doc = make([line(10000), line(5000, "reduced", sku="S0")], [pct("Spring sale", "10"), fixed("Welcome", 500)],
               terms_days=10)
    number = store.issue({**doc, "issued": "2026-02-27"})
    assert number == "2026-0003"
    stored = store.load(number)
    computed = api.compute({**doc, "issued": "2026-02-27", "number": number})
    for key in ("subtotal_cents", "discount_cents", "tax_cents", "total_cents", "discounts"):
        assert stored[key] == computed[key]
    assert store.show(number) == api.render_stored(stored)
    rows, at = split_rows(store.show(number))
    assert len(at["discounts"]) == 2
    assert 'class="discount"' in store.show(number, "html")

    out = parse_csv(export_csv(store.all()))
    assert list(out[0]) == ["number", "issued", "customer", "currency", "subtotal", "tax", "total"]
    assert [r["number"] for r in out] == OLD + [number]
    for row in out:  # finance's importer rejects a row where subtotal + tax != total
        assert Decimal(row["subtotal"]) + Decimal(row["tax"]) == Decimal(row["total"]), row
    new = out[-1]
    assert Decimal(new["total"]) * 100 == computed["total_cents"]
    assert Decimal(new["tax"]) * 100 == computed["tax_cents"]
    assert Decimal(new["subtotal"]) * 100 == computed["subtotal_cents"] - computed["discount_cents"]
    assert out[:4] == parse_csv((HIDDEN / "golden" / "export.csv").read_text())


def test_reminders_ask_for_the_discounted_amount(tmp_path):
    store, root = old_store(tmp_path)
    doc = make([line(10000)], [pct("Loyalty", "10")], terms_days=10)
    store.issue({**doc, "issued": "2026-02-01"})
    text = cli("remind", "--store", str(root), "--today", "2026-03-20", "--paid", *OLD)
    assert "for $107.10 was due on 2026-02-11" in text  # 90.00 + 17.10 tax


def test_the_command_line_end_to_end(tmp_path):
    path = tmp_path / "invoice.json"
    path.write_text(json.dumps(make([line(10000)], [pct("Loyalty", "10")])))
    computed = json.loads(cli("compute", str(path)))
    assert (computed["discount_cents"], computed["total_cents"]) == (1000, 10710)
    assert "Discount (Loyalty)" in cli("render", str(path))
    assert 'class="discount"' in cli("render", str(path), "--format", "html")
    store = str(tmp_path / "store")
    assert cli("issue", str(path), "--store", store) == "2026-0001\n"
    assert "Discount (Loyalty)" in cli("show", "2026-0001", "--store", store)
    assert cli("export", "--store", store).splitlines()[1].startswith("2026-0001,2026-03-02,Acme GmbH,USD,90.00,17.10,107.10")


def test_documents_are_not_modified(tmp_path):
    doc = make([line(10000)], [pct("Loyalty", "10"), fixed("Welcome", 500)])
    before = copy.deepcopy(doc)
    api.compute(doc)
    api.render(doc)
    assert doc == before
