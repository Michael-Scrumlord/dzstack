"""Command line: python -m billing <command>. Errors print 'error: ...' on stderr and exit with status 2."""
from __future__ import annotations

import argparse
import json
import sys
from datetime import date

from . import aging, api, installments, reminders, statement
from .errors import BillingError
from .export import export_csv
from .store import Store


def _load(path: str):
    try:
        text = sys.stdin.read() if path == "-" else open(path, encoding="utf-8").read()
        return json.loads(text)
    except OSError as err:
        raise BillingError(f"cannot read {path}: {err.strerror}") from None
    except ValueError as err:
        raise BillingError(f"{path} is not valid JSON: {err}") from None


def _date(text: str, flag: str) -> date:
    try:
        return date.fromisoformat(text)
    except ValueError:
        raise BillingError(f"{flag} must be a date such as 2026-03-02") from None


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="billing")
    sub = parser.add_subparsers(dest="command", required=True)

    p = sub.add_parser("compute", help="print the computed invoice as JSON")
    p.add_argument("file")

    p = sub.add_parser("render", help="print the invoice for a document")
    p.add_argument("file")
    p.add_argument("--format", choices=sorted(api.RENDERERS), default="text")

    p = sub.add_parser("issue", help="store the invoice under the next number")
    p.add_argument("file")
    p.add_argument("--store", required=True)

    p = sub.add_parser("show", help="print an issued invoice")
    p.add_argument("number")
    p.add_argument("--store", required=True)
    p.add_argument("--format", choices=sorted(api.RENDERERS), default="text")

    p = sub.add_parser("export", help="print the ledger CSV for every issued invoice")
    p.add_argument("--store", required=True)

    p = sub.add_parser("remind", help="reminders for overdue invoices")
    p.add_argument("--store", required=True)
    p.add_argument("--today", required=True)
    p.add_argument("--paid", nargs="*", default=[])

    p = sub.add_parser("aging", help="overdue amounts by customer and age")
    p.add_argument("--store", required=True)
    p.add_argument("--today", required=True)
    p.add_argument("--paid", nargs="*", default=[])

    p = sub.add_parser("statement", help="one customer's invoices with a running balance")
    p.add_argument("customer")
    p.add_argument("--store", required=True)
    p.add_argument("--paid", nargs="*", default=[])

    p = sub.add_parser("plan", help="split an amount into monthly instalments")
    p.add_argument("total_cents", type=int)
    p.add_argument("parts", type=int)
    p.add_argument("--first-due", required=True)
    return parser


def run(args: argparse.Namespace, out) -> None:
    if args.command == "compute":
        out.write(json.dumps(api.compute(_load(args.file)), indent=2, sort_keys=True) + "\n")
    elif args.command == "render":
        out.write(api.render(_load(args.file), args.format))
    elif args.command == "issue":
        out.write(Store(args.store).issue(_load(args.file)) + "\n")
    elif args.command == "show":
        out.write(Store(args.store).show(args.number, args.format))
    elif args.command == "export":
        out.write(export_csv(Store(args.store).all()))
    elif args.command == "remind":
        for entry in reminders.overdue(Store(args.store).all(), set(args.paid), _date(args.today, "--today")):
            out.write(reminders.reminder_text(entry) + "\n")
    elif args.command == "aging":
        out.write(aging.render_aging(aging.aging(Store(args.store).all(), set(args.paid), _date(args.today, "--today"))))
    elif args.command == "statement":
        rows = statement.statement(Store(args.store).all(), args.customer, set(args.paid))
        out.write(statement.render_statement(args.customer, rows))
    elif args.command == "plan":
        try:
            first_due = date.fromisoformat(args.first_due)
            rows = installments.plan(args.total_cents, args.parts, first_due)
        except ValueError as err:
            raise BillingError(str(err)) from None
        out.write(json.dumps(rows, indent=2) + "\n")


def main(argv=None, stdout=None, stderr=None) -> int:
    out, err = stdout or sys.stdout, stderr or sys.stderr
    args = _parser().parse_args(argv)
    try:
        run(args, out)
    except BillingError as problem:
        err.write(f"error: {problem}\n")
        return 2
    return 0
