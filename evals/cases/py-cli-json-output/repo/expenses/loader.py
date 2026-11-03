"""Read an expenses CSV into Expense rows."""
from __future__ import annotations

import csv
import datetime
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation, ROUND_HALF_UP

REQUIRED = ("date", "category", "amount")
CENT = Decimal("0.01")


class LoadError(Exception):
    """The file cannot be read as an expenses CSV."""


@dataclass(frozen=True)
class Expense:
    date: datetime.date
    category: str
    amount: Decimal  # rounded to cents; negative for a refund


def parse_amount(raw: str, line: int) -> Decimal:
    try:
        value = Decimal(raw.strip().replace(",", ""))
        if not value.is_finite():
            raise InvalidOperation
        return value.quantize(CENT, rounding=ROUND_HALF_UP)
    except InvalidOperation:
        raise LoadError(f"line {line}: invalid amount {raw!r}") from None


def parse_date(raw: str, line: int) -> datetime.date:
    try:
        return datetime.date.fromisoformat(raw.strip())
    except ValueError:
        raise LoadError(f"line {line}: invalid date {raw!r}") from None


def load_expenses(path: str) -> list[Expense]:
    with open(path, newline="", encoding="utf-8-sig") as fh:
        reader = csv.reader(fh)
        header = next(reader, None)
        if header is None:
            return []
        columns = {name.strip().lower(): i for i, name in enumerate(header)}
        missing = [name for name in REQUIRED if name not in columns]
        if missing:
            raise LoadError(f"missing column(s): {', '.join(missing)}")
        expenses = []
        for row in reader:
            if not any(cell.strip() for cell in row):
                continue
            line = reader.line_num
            if len(row) <= max(columns[name] for name in REQUIRED):
                raise LoadError(f"line {line}: too few columns")
            category = row[columns["category"]].strip() or "Uncategorized"
            expenses.append(Expense(
                date=parse_date(row[columns["date"]], line),
                category=category,
                amount=parse_amount(row[columns["amount"]], line),
            ))
    return expenses
