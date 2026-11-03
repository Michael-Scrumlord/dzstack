"""Hidden checks for `--format json`: the CLI runs as a subprocess on CSVs the agent never saw."""
import json
import subprocess
import sys
from decimal import Decimal
from pathlib import Path

import pytest

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
DATA = HERE / "hidden_data"
GOLDEN = json.loads((DATA / "text_golden.json").read_text(encoding="utf-8"))
D = Decimal


def cli(csv_name, *args):
    return subprocess.run(
        [sys.executable, "-B", "-m", "expenses", str(DATA / csv_name), *args],
        cwd=ROOT, capture_output=True, text=True, encoding="utf-8", timeout=60,
    )


def as_json(csv_name, *args):
    """Run with --format json and parse the numbers as exact decimals."""
    proc = cli(csv_name, "--format", "json", *args)
    assert proc.returncode == 0, proc.stderr
    assert proc.stderr == ""
    return json.loads(proc.stdout, parse_float=D)


def doc(rows, count, total):
    return {"categories": [{"category": c, "count": n, "total": D(t)} for c, n, t in rows],
            "count": count, "total": D(total)}


BASIC = [("Rent", 1, "1200.00"), ("Groceries", 3, "168.70"), ("Transport", 2, "82.20"), ("Dining", 1, "48.30")]


def test_summary_as_json():
    assert as_json("basic.csv") == doc(BASIC, 7, "1499.20")


def test_numbers_are_numbers_and_counts_are_integers():
    result = as_json("basic.csv")
    for obj in [result, *result["categories"]]:
        assert isinstance(obj["count"], int) and not isinstance(obj["count"], bool)
        assert isinstance(obj["total"], (int, D)) and not isinstance(obj["total"], bool)


def test_keys_come_in_the_documented_order():
    proc = cli("basic.csv", "--format", "json")
    top = json.loads(proc.stdout, object_pairs_hook=list)
    assert [k for k, _ in top] == ["categories", "count", "total"]
    categories = dict(top)["categories"]
    assert categories and all([k for k, _ in c] == ["category", "count", "total"] for c in categories)


def test_quoted_commas_thousands_and_rounding():
    proc = cli("quoted.csv", "--format", "json")
    assert proc.returncode == 0 and proc.stderr == ""
    assert "1,234" not in proc.stdout  # no thousands separator inside the numbers
    assert json.loads(proc.stdout, parse_float=D) == doc(
        [("Travel", 2, "1234367.89"), ("Dining, Out", 3, "86.70"), ("Café & Bar", 1, "12.35")], 6, "1234466.94")


def test_a_category_with_only_refunds_and_a_category_that_nets_to_zero():
    assert as_json("refunds.csv") == doc(
        [("Groceries", 3, "40.30"), ("Gadgets", 2, "0.00"), ("Returns", 2, "-85.50")], 7, "-45.20")


def test_no_float_noise_in_sums():
    # 40.00 + 0.10 + 0.20 must print as 40.3, not 40.300000000000004
    proc = cli("refunds.csv", "--format", "json")
    groceries = json.loads(proc.stdout, parse_float=D)["categories"][0]
    assert groceries["total"] == D("40.30")
    assert "00000" not in proc.stdout


@pytest.mark.parametrize("csv_name", ["empty.csv", "header_only.csv"])
def test_no_expenses(csv_name):
    proc = cli(csv_name, "--format", "json")
    assert proc.returncode == 0 and proc.stderr == ""
    assert json.loads(proc.stdout) == {"categories": [], "count": 0, "total": 0}
    assert "No expenses found" not in proc.stdout


def test_nothing_left_after_month_filter():
    proc = cli("basic.csv", "--format", "json", "--month", "2030-01")
    assert proc.returncode == 0
    assert json.loads(proc.stdout) == {"categories": [], "count": 0, "total": 0}


def test_month_filter_applies_to_json():
    assert as_json("basic.csv", "--month", "2024-03") == doc(
        [("Rent", 1, "1200.00"), ("Groceries", 3, "168.70"), ("Transport", 1, "64.00"), ("Dining", 1, "48.30")],
        6, "1481.00")


def test_sort_by_name_applies_to_json():
    names = [c["category"] for c in as_json("basic.csv", "--sort", "name")["categories"]]
    assert names == ["Dining", "Groceries", "Rent", "Transport"]


def text_order(csv_name, *args):
    out = cli(csv_name, *args).stdout.splitlines()
    return [line.split()[0] for line in out[2:-2]]


@pytest.mark.parametrize("args", [(), ("--sort", "name"), ("--month", "2024-01")])
def test_json_lists_categories_in_the_text_table_order(args):
    names = [c["category"] for c in as_json("ties.csv", *args)["categories"]]
    assert names == text_order("ties.csv", *args)
    assert len(names) == len(set(names)) >= 4


@pytest.mark.parametrize("key", sorted(GOLDEN))
def test_text_output_is_unchanged(key):
    csv_name, _, arg_text = key.partition("|")
    args = arg_text.split()
    expected = GOLDEN[key]
    plain = cli(csv_name, *args)
    assert (plain.returncode, plain.stdout, plain.stderr) == (0, expected, "")
    explicit = cli(csv_name, "--format", "text", *args)
    assert (explicit.returncode, explicit.stdout, explicit.stderr) == (0, expected, "")


@pytest.mark.parametrize("fmt", ["text", "json"])
@pytest.mark.parametrize("csv_name, message", [
    ("bad_amount.csv", "expenses: line 3: invalid amount 'twelve'\n"),
    ("missing_column.csv", "expenses: missing column(s): amount\n"),
    ("does_not_exist.csv", None),
])
def test_errors_are_the_same_in_both_formats(fmt, csv_name, message):
    proc = cli(csv_name, "--format", fmt)
    assert proc.returncode == 2
    assert proc.stdout == ""
    if message is None:
        assert proc.stderr.startswith("expenses: ")
    else:
        assert proc.stderr == message


def test_unknown_format_is_rejected_by_argparse():
    proc = cli("basic.csv", "--format", "xml")
    assert proc.returncode == 2 and proc.stdout == ""
    assert "--format" in proc.stderr
