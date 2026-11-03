import pytest

from expenses.cli import main

CSV = """date,category,description,amount
2024-03-01,Rent,March,1200.00
2024-03-02,Food,Shop,30.00
2024-03-09,Food,Shop,12.50
2024-04-01,Fun,Cinema,42.50
"""

TABLE = """Category  Count     Total
--------  -----  --------
Rent          1  1,200.00
Food          2     42.50
Fun           1     42.50
--------  -----  --------
Total         4  1,285.00
"""


MARCH_BY_NAME = """Category  Count     Total
--------  -----  --------
Food          2     42.50
Rent          1  1,200.00
--------  -----  --------
Total         3  1,242.50
"""


def run(tmp_path, capsys, text, *args):
    path = tmp_path / "e.csv"
    path.write_text(text, encoding="utf-8")
    code = main([str(path), *args])
    out = capsys.readouterr()
    return code, out.out, out.err


def test_prints_a_table(tmp_path, capsys):
    code, out, err = run(tmp_path, capsys, CSV)
    assert (code, err) == (0, "")
    assert out == TABLE


def test_month_and_sort(tmp_path, capsys):
    code, out, _ = run(tmp_path, capsys, CSV, "--month", "2024-03", "--sort", "name")
    assert code == 0
    assert out == MARCH_BY_NAME


def test_empty_file(tmp_path, capsys):
    assert run(tmp_path, capsys, "") == (0, "No expenses found.\n", "")


def test_nothing_in_month(tmp_path, capsys):
    assert run(tmp_path, capsys, CSV, "--month", "2030-01") == (0, "No expenses found.\n", "")


def test_bad_amount_is_an_error(tmp_path, capsys):
    code, out, err = run(tmp_path, capsys, "date,category,amount\n2024-03-01,Food,abc\n")
    assert (code, out) == (2, "")
    assert err == "expenses: line 2: invalid amount 'abc'\n"


def test_missing_file(tmp_path, capsys):
    assert main([str(tmp_path / "nope.csv")]) == 2
    assert capsys.readouterr().out == ""


def test_bad_month_is_rejected(tmp_path):
    with pytest.raises(SystemExit) as exc:
        main([str(tmp_path / "x.csv"), "--month", "2024-13"])
    assert exc.value.code == 2
