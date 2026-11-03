import io

import pytest

from reportly.errors import ConfigError, RowError
from reportly.plugins import get_format


def render(columns, rows, **options):
    out = io.StringIO()
    get_format("text")(**options).render(columns, rows, out)
    return out.getvalue()


def test_a_table_with_aligned_columns(columns, rows):
    assert render(columns, rows) == (
        "Region            Amount  Units  Closed      OK\n"
        "--------------  --------  -----  ----------  ---\n"
        "Europe          1,234.50     12  2025-03-09  yes\n"
        "Asia | Pacific    -20.00      3  2025-03-30  no\n"
        "Americas            0.50  1,500  -           -\n"
        "(3 rows)\n"
    )


def test_it_does_not_stream():
    assert get_format("text").streaming is False


def test_an_empty_report_has_its_header_and_a_count(columns):
    assert render(columns, []) == (
        "Region  Amount  Units  Closed  OK\n"
        "------  ------  -----  ------  --\n"
        "(0 rows)\n"
    )


def test_max_width_cuts_long_cells(columns, rows):
    out = render(columns, rows, max_width=8)
    assert "Asia ..." in out
    assert "Asia | Pacific" not in out


def test_a_row_of_the_wrong_length_is_an_error(columns, rows):
    with pytest.raises(RowError) as caught:
        render(columns, [rows[0], rows[1][:3]])
    assert (caught.value.row_number, caught.value.expected, caught.value.got) == (2, 5, 3)


def test_options_are_checked(columns, rows):
    with pytest.raises(ConfigError, match="no option 'colour'"):
        render(columns, rows, colour="red")
    with pytest.raises(ConfigError, match="max_width"):
        render(columns, rows, max_width=-1)
    with pytest.raises(ConfigError, match="max_width"):
        render(columns, rows, max_width="wide")
