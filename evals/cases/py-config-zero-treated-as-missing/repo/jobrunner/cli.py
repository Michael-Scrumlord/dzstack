"""Command line entry point: python -m jobrunner jobs.json [--only NAME]."""
from __future__ import annotations

import argparse
import logging
import sys

from .config import ConfigError, load_config
from .runner import log, run_all


def _notify(recipients: list[str], message: str) -> None:
    log.error("notifying %s: %s", ", ".join(recipients), message)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="jobrunner", description="Run the jobs in a jobs.json file.")
    parser.add_argument("config", help="path to jobs.json")
    parser.add_argument("--only", metavar="NAME", help="run just this job")
    args = parser.parse_args(argv)

    logging.basicConfig(stream=sys.stderr, level=logging.INFO,
                        format="%(asctime)s %(levelname)-7s %(message)s", datefmt="%Y-%m-%d %H:%M:%S")
    try:
        jobs = load_config(args.config)
    except (ConfigError, OSError) as exc:
        print(f"jobrunner: {exc}", file=sys.stderr)
        return 2
    if args.only:
        jobs = [j for j in jobs if j.name == args.only]
        if not jobs:
            print(f"jobrunner: no job named {args.only!r}", file=sys.stderr)
            return 2
    results = run_all(jobs, notify=_notify)
    return 1 if any(r.status in ("failed", "timeout") for r in results) else 0
