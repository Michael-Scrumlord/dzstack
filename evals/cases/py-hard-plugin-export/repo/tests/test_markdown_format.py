import io

import pytest

from reportly.errors import RowError
from reportly.plugins import get_format


def render(columns, rows, **options):
    out = io.StringIO()
    get_format("markdown")(**options).render(columns, rows, out)
    return out.getvalue()


def test_a_github_table(columns, rows):
    assert render(columns, rows) == (
        "| Region | Amount | Units | Closed | OK |\n"
        "| --- | ---: | ---: | --- | --- |\n"
        "| Europe | 1,234.50 | 12 | 2025-03-09 | yes |\n"
        "| Asia \\| Pacific | -20.00 | 3 | 2025-03-30 | no |\n"
        "| Americas | 0.50 | 1,500 | - | - |\n"
    )


def test_escaping_can_be_turned_off(columns, rows):
    assert "| Asia | Pacific |" in render(columns, rows, escape=False)


def test_it_streams_one_row_at_a_time(columns, rows):
    assert get_format("markdown").streaming is True
    written = []

    class Out:
        def write(self, text):
            written.append((text, pulled[0]))

    pulled = [0]

    def feed():
        for row in rows:
            pulled[0] += 1
            yield row

    get_format("markdown")().render(columns, feed(), Out())
    # the header is written before any row is pulled, every row right after it is pulled
    assert [p for _, p in written] == [0, 0, 1, 2, 3]


def test_a_row_of_the_wrong_length_is_an_error(columns, rows):
    with pytest.raises(RowError, match="row 1: expected 5 values, got 2"):
        render(columns, [rows[0][:2]])
