import json
from datetime import date
from decimal import Decimal

import pytest

from reportly.columns import Column

COLUMNS = (
    Column("region", "Region"),
    Column("amount", "Amount", "decimal"),
    Column("units", "Units", "int"),
    Column("closed", "Closed", "date"),
    Column("ok", "OK", "bool"),
)

ROWS = [
    ("Europe", Decimal("1234.50"), 12, date(2025, 3, 9), True),
    ("Asia | Pacific", Decimal("-20.00"), 3, date(2025, 3, 30), False),
    ("Americas", Decimal("0.5"), 1500, None, None),
]


@pytest.fixture
def columns():
    return COLUMNS


@pytest.fixture
def rows():
    return list(ROWS)


@pytest.fixture
def sales_jsonl(tmp_path):
    lines = [
        {"region": "Europe", "amount": "1234.50", "units": 12, "closed": "2025-03-09", "ok": True},
        {"region": "Asia | Pacific", "amount": -20, "units": 3, "closed": "2025-03-30", "ok": False},
        {"region": "Americas", "amount": 0.5, "units": 1500},
    ]
    path = tmp_path / "sales.jsonl"
    path.write_text("\n".join(json.dumps(line) for line in lines) + "\n", encoding="utf-8")
    return path


SALES_TOML = """\
{head}
[reports.sales]
source = "jsonl"
path = "sales.jsonl"
columns = [
  {{ key = "region", title = "Region" }},
  {{ key = "amount", title = "Amount", kind = "decimal" }},
  {{ key = "units", title = "Units", kind = "int" }},
  {{ key = "closed", title = "Closed", kind = "date" }},
  {{ key = "ok", title = "OK", kind = "bool" }},
]
"""


@pytest.fixture
def write_config(tmp_path, sales_jsonl):
    def write(head: str = "", name: str = "reportly.toml"):
        path = tmp_path / name
        path.write_text(SALES_TOML.format(head=head), encoding="utf-8")
        return path

    return write
