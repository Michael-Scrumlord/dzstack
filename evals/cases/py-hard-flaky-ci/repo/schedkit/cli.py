"""`python -m schedkit next "daily 09:00" -n 3 --from 2025-03-08T12:00Z` prints the next runs."""
from __future__ import annotations

import argparse
import sys
from datetime import datetime
from typing import Sequence, TextIO

from schedkit.clock import SystemClock
from schedkit.errors import SchedkitError
from schedkit.rules import parse_rule
from schedkit.timeutil import to_local_naive, utc_iso


def _parse_from(text: str) -> datetime:
    return datetime.fromisoformat(text.replace("Z", "+00:00"))


def main(argv: Sequence[str] | None = None, out: TextIO | None = None) -> int:
    out = out or sys.stdout
    parser = argparse.ArgumentParser(prog="schedkit")
    sub = parser.add_subparsers(dest="command", required=True)
    nxt = sub.add_parser("next", help="print the next runs of a rule")
    nxt.add_argument("rule")
    nxt.add_argument("-n", type=int, default=5, help="how many runs (default 5)")
    nxt.add_argument("--from", dest="start", help="ISO time to start after (default: now)")
    args = parser.parse_args(argv)
    try:
        rule = parse_rule(args.rule)
        start = _parse_from(args.start) if args.start else SystemClock().now()
        for run in rule.occurrences(start, args.n):
            out.write(f"{utc_iso(run)}  local {to_local_naive(run):%Y-%m-%d %H:%M}\n")
    except (SchedkitError, ValueError) as exc:
        sys.stderr.write(f"schedkit: {exc}\n")
        return 2
    return 0
