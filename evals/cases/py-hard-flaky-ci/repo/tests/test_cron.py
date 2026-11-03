import pytest

from schedkit.cron import parse_cron
from schedkit.errors import RuleSyntaxError
from schedkit.rules import parse_rule


@pytest.mark.parametrize(
    "expression, text",
    [
        ("30 6 * * *", "daily 06:30"),
        ("0 9 * * 1-5", "weekly mon-fri 09:00"),
        ("0 9 * * 0", "weekly sun 09:00"),
        ("0 9 * * 7,1", "weekly sun,mon 09:00"),
        ("15 4 1 * *", "monthly 1 04:15"),
        ("*/10 * * * *", "every 10 minutes"),
    ],
)
def test_supported_shapes(expression, text):
    assert parse_cron(expression).describe() == parse_rule(text).describe()


@pytest.mark.parametrize("expression", ["* * * *", "0 9 * 6 *", "0 9 1 * 1", "61 9 * * *", "0 24 * * *", "0 9 * * 8", "*/0 * * * *", "0,30 9 * * *"])
def test_unsupported_or_invalid(expression):
    with pytest.raises(RuleSyntaxError):
        parse_cron(expression)
