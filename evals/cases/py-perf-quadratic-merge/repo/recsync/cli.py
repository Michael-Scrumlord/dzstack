"""python -m recsync BASE.jsonl INCOMING.jsonl -o MERGED.jsonl"""
from __future__ import annotations

import argparse
import sys

from .jsonl import read_jsonl, write_jsonl
from .merge import merge_records


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="recsync", description="Merge two JSONL exports of the customer table.")
    parser.add_argument("base", help="the existing export")
    parser.add_argument("incoming", help="the new export")
    parser.add_argument("-o", "--output", required=True, help="where to write the merged export")
    args = parser.parse_args(argv)
    try:
        merged = merge_records(read_jsonl(args.base), read_jsonl(args.incoming))
        count = write_jsonl(args.output, merged)
    except (OSError, ValueError, KeyError) as exc:
        print(f"recsync: {exc}", file=sys.stderr)
        return 2
    print(f"{count} records written to {args.output}")
    return 0
