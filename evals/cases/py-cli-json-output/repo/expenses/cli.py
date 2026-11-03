"""Command line entry point."""
from __future__ import annotations

import argparse
import re
import sys

from .loader import LoadError, load_expenses
from .render import render_text
from .report import summarize


def _month(text: str) -> str:
    if not re.fullmatch(r"\d{4}-(0[1-9]|1[0-2])", text):
        raise argparse.ArgumentTypeError(f"{text!r} is not a month like 2024-03")
    return text


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="expenses", description="Summarize an expenses CSV by category.")
    parser.add_argument("csv_file", help="path to the CSV file")
    parser.add_argument("--month", type=_month, metavar="YYYY-MM", help="only expenses dated in this month")
    parser.add_argument("--sort", choices=("total", "name"), default="total",
                        help="order of the categories (default: total, largest first)")
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    try:
        expenses = load_expenses(args.csv_file)
    except (LoadError, OSError, UnicodeDecodeError) as exc:
        print(f"expenses: {exc}", file=sys.stderr)
        return 2
    summary = summarize(expenses, month=args.month, sort=args.sort)
    if summary.count == 0:
        print("No expenses found.")
        return 0
    print(render_text(summary), end="")
    return 0
