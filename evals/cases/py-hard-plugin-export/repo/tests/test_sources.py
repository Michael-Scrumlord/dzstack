import sqlite3
from datetime import date
from decimal import Decimal

import pytest

from reportly.columns import Column, convert, parse_columns
from reportly.errors import ConfigError, SourceError
from reportly.sources import JsonlSource, MemorySource, SqliteSource, build_source


def test_jsonl_rows_are_converted_by_column_kind(columns, sales_jsonl):
    rows = list(JsonlSource(columns, sales_jsonl).rows())
    assert rows[0] == ("Europe", Decimal("1234.50"), 12, date(2025, 3, 9), True)
    assert rows[1][1] == Decimal("-20")
    assert rows[2][3:] == (None, None)


def test_jsonl_is_lazy(columns, sales_jsonl):
    rows = JsonlSource(columns, sales_jsonl).rows()
    assert next(rows)[0] == "Europe"


def test_jsonl_errors_name_the_line(columns, tmp_path):
    path = tmp_path / "bad.jsonl"
    path.write_text('{"region": "a"}\n\n[1]\n', encoding="utf-8")
    with pytest.raises(SourceError, match=r"bad.jsonl:3: expected an object"):
        list(JsonlSource(columns, path).rows())
    with pytest.raises(SourceError, match="cannot open"):
        list(JsonlSource(columns, tmp_path / "missing.jsonl").rows())


def test_sqlite_rows(tmp_path):
    db = tmp_path / "d.sqlite"
    conn = sqlite3.connect(db)
    conn.execute("create table t (name text, qty integer)")
    conn.executemany("insert into t values (?, ?)", [("a", 1), ("b", None)])
    conn.commit()
    conn.close()
    columns = (Column("name", "Name"), Column("qty", "Qty", "int"))
    source = SqliteSource(columns, db, "select name, qty from t order by name")
    assert list(source.rows()) == [("a", 1), ("b", None)]
    with pytest.raises(SourceError, match="query returns 1 columns, the report has 2"):
        list(SqliteSource(columns, db, "select name from t").rows())
    with pytest.raises(SourceError, match="no such table"):
        list(SqliteSource(columns, db, "select name, qty from nope").rows())


def test_memory_source_streams_generators():
    pulled = []

    def gen():
        for i in range(3):
            pulled.append(i)
            yield [i]

    rows = MemorySource((Column("n", "N", "int"),), gen()).rows()
    assert next(rows) == (0,)
    assert pulled == [0]


def test_build_source_checks_settings(columns, tmp_path):
    with pytest.raises(ConfigError, match="`path` is required"):
        build_source("jsonl", columns, {}, tmp_path)
    with pytest.raises(ConfigError, match="unknown setting 'colour'"):
        build_source("jsonl", columns, {"path": "x", "colour": 1}, tmp_path)


@pytest.mark.parametrize(
    "kind, raw, expected",
    [
        ("int", "42", 42),
        ("decimal", 0.1, Decimal("0.1")),
        ("date", "2025-03-09T10:00:00", date(2025, 3, 9)),
        ("bool", "Yes", True),
        ("bool", 0, False),
        ("text", 5, "5"),
        ("int", None, None),
    ],
)
def test_convert(kind, raw, expected):
    assert convert(kind, raw) == expected


def test_convert_failures_are_source_errors():
    for kind, raw in [("int", "x"), ("int", True), ("decimal", "1.2.3"), ("date", "yesterday"), ("bool", "maybe")]:
        with pytest.raises(SourceError, match="cannot read"):
            convert(kind, raw)


def test_parse_columns_defaults_the_title_to_the_key():
    (column,) = parse_columns([{"key": "region"}])
    assert (column.key, column.title, column.kind) == ("region", "region", "text")
    with pytest.raises(ConfigError, match="unique"):
        parse_columns([{"key": "a"}, {"key": "a"}])
