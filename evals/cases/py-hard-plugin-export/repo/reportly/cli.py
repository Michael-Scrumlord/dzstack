"""Command line: `reportly run`, `reportly formats`, `reportly reports`. See docs/cli.md."""
from __future__ import annotations

import argparse
import os
import sys
import time
from pathlib import Path
from typing import Mapping, Sequence, TextIO

from reportly import __version__
from reportly.config import Settings, find_config, load_settings
from reportly.errors import ConfigError, ReportlyError, UsageError
from reportly.plugins import available_formats, get_format, load_plugins
from reportly.runner import open_output, run_report
from reportly.util.text import plural
from reportly.util.units import humanize_seconds


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="reportly", description="Build reports from data sources.")
    parser.add_argument("--version", action="version", version=f"reportly {__version__}")
    sub = parser.add_subparsers(dest="command", required=True)

    common = argparse.ArgumentParser(add_help=False)
    common.add_argument("--config", metavar="FILE", help="config file (default: $REPORTLY_CONFIG, then ./reportly.toml)")

    run = sub.add_parser("run", parents=[common], help="run a report")
    run.add_argument("report", help="name of a report from the config file")
    run.add_argument("--format", "-f", metavar="NAME", help="output format (see `reportly formats`)")
    run.add_argument("--output", "-o", metavar="FILE", help="write to FILE instead of standard output")
    run.add_argument("--option", "-O", action="append", default=[], metavar="NAME=VALUE", help="format option, may be repeated")
    run.add_argument("--stats", action="store_true", help="print the row count and run time to standard error")

    sub.add_parser("formats", parents=[common], help="list the output formats")
    sub.add_parser("reports", parents=[common], help="list the reports in the config file")
    return parser


def _parse_options(pairs: Sequence[str]) -> dict[str, str]:
    options = {}
    for pair in pairs:
        name, sep, value = pair.partition("=")
        if not sep or not name:
            raise UsageError(f"--option expects NAME=VALUE, got {pair!r}")
        options[name] = value
    return options


def _cmd_formats(settings: Settings, stdout: TextIO) -> int:
    formats = available_formats()
    width = max(len(f.name) for f in formats)
    for fmt in formats:
        stdout.write(f"{fmt.name.ljust(width)}  {fmt.extension.ljust(6)} {fmt.description}\n")
    return 0


def _cmd_reports(settings: Settings, stdout: TextIO) -> int:
    if not settings.reports:
        stdout.write("(no reports defined)\n")
    for name, report in settings.reports.items():
        stdout.write(f"{name}  ({plural(len(report.columns), 'column')})\n")
    return 0


def _cmd_run(args: argparse.Namespace, settings: Settings, stdout: TextIO, stderr: TextIO) -> int:
    try:
        report = settings.reports[args.report]
    except KeyError:
        known = ", ".join(sorted(settings.reports)) or "none"
        raise UsageError(f"unknown report {args.report!r} (defined: {known})") from None
    get_format(settings.format)  # fail early, with the list of formats, before any file is opened
    options = {**settings.options_for(settings.format), **_parse_options(args.option)}
    started = time.perf_counter()
    with open_output(settings.output, stdout) as out:
        count = run_report(report, settings.format, out, options)
    if args.stats:
        stderr.write(f"{plural(count, 'row')} in {humanize_seconds(time.perf_counter() - started)}\n")
    return 0


def main(
    argv: Sequence[str] | None = None,
    *,
    stdout: TextIO | None = None,
    stderr: TextIO | None = None,
    env: Mapping[str, str] | None = None,
    cwd: Path | None = None,
) -> int:
    stdout = stdout if stdout is not None else sys.stdout
    stderr = stderr if stderr is not None else sys.stderr
    env = env if env is not None else os.environ
    cwd = cwd if cwd is not None else Path.cwd()
    try:
        args = _parser().parse_args(argv)
    except SystemExit as exc:  # argparse already printed its message
        return int(exc.code or 0)
    try:
        path = find_config(args.config, env, cwd)
        settings = load_settings(path, env, format=getattr(args, "format", None), output=getattr(args, "output", None))
        load_plugins(settings.plugin_modules)
        if args.command == "formats":
            return _cmd_formats(settings, stdout)
        if args.command == "reports":
            return _cmd_reports(settings, stdout)
        return _cmd_run(args, settings, stdout, stderr)
    except ReportlyError as exc:
        stderr.write(f"reportly: error: {exc}\n")
        return exc.exit_code
