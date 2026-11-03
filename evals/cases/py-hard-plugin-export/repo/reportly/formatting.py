"""How values become text. Two families, and a format picks one (see docs/plugins.md, "Cell values").

display(): for people. Thousands separators, two decimals, "yes"/"no".
machine(): for programs and spreadsheets. Exact values, no separators, ISO dates.
"""
from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Any


def display(value: Any) -> str:
    if value is None:
        return "-"
    if isinstance(value, bool):
        return "yes" if value else "no"
    if isinstance(value, int):
        return f"{value:,}"
    if isinstance(value, (float, Decimal)):
        return f"{value:,.2f}"
    if isinstance(value, datetime):
        return value.strftime("%Y-%m-%d %H:%M")
    if isinstance(value, date):
        return value.isoformat()
    return str(value).replace("\r\n", " ").replace("\n", " ").replace("\r", " ")


def machine(value: Any) -> str:
    """Empty for None, `true`/`false` for booleans, exact digits for numbers, ISO 8601 for dates."""
    if value is None:
        return ""
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, int):
        return str(value)
    if isinstance(value, float):
        return repr(value)
    if isinstance(value, Decimal):
        return format(value, "f")
    if isinstance(value, datetime):
        return value.isoformat()
    if isinstance(value, date):
        return value.isoformat()
    return str(value)
