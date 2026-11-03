import pytest

from reportly.errors import ConfigError
from reportly.transform import first, only_where


def test_only_where_keeps_matching_rows(columns, rows):
    assert list(only_where(rows, columns, {"region": "Europe"})) == [rows[0]]
    assert list(only_where(rows, columns, {"ok": None})) == [rows[2]]
    assert list(only_where(rows, columns, {})) == rows


def test_only_where_checks_column_names(columns, rows):
    with pytest.raises(ConfigError, match="no column 'nope'"):
        list(only_where(rows, columns, {"nope": 1}))


def test_first_stops_early():
    pulled = []

    def gen():
        for i in range(100):
            pulled.append(i)
            yield (i,)

    assert list(first(gen(), 2)) == [(0,), (1,)]
    assert len(pulled) == 3  # it looked at one row past the limit, no more
    assert list(first(iter([(1,)]), 0)) == []
    with pytest.raises(ConfigError):
        list(first(iter([]), -1))
