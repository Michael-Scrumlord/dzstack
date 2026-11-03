import io
from pathlib import Path

import pytest

from reportly.cli import main

TEXT = (
    "Region            Amount  Units  Closed      OK\n"
    "--------------  --------  -----  ----------  ---\n"
    "Europe          1,234.50     12  2025-03-09  yes\n"
    "Asia | Pacific    -20.00      3  2025-03-30  no\n"
    "Americas            0.50  1,500  -           -\n"
    "(3 rows)\n"
)


def run(*argv, env=None, cwd=None):
    out, err = io.StringIO(), io.StringIO()
    code = main(list(argv), stdout=out, stderr=err, env=env if env is not None else {}, cwd=cwd or Path("/nonexistent"))
    return code, out.getvalue(), err.getvalue()


def test_text_is_the_default(write_config):
    path = write_config()
    assert run("run", "sales", "--config", str(path)) == (0, TEXT, "")


def test_format_flag(write_config):
    path = write_config()
    code, out, _ = run("run", "sales", "--config", str(path), "--format", "markdown")
    assert code == 0
    assert out.startswith("| Region | Amount | Units | Closed | OK |\n")


def test_format_from_the_config_file_and_the_environment(write_config):
    path = write_config('format = "markdown"\n')
    assert run("run", "sales", "--config", str(path))[1].startswith("| Region |")
    assert run("run", "sales", "--config", str(path), env={"REPORTLY_FORMAT": "text"})[1] == TEXT
    assert run("run", "sales", "--config", str(path), "-f", "text")[1] == TEXT


def test_the_config_is_found_in_the_working_folder(write_config, tmp_path):
    write_config()
    assert run("run", "sales", cwd=tmp_path)[1] == TEXT


def test_options_from_the_file_and_from_the_flag(write_config):
    path = write_config("[formats.markdown]\nescape = false\n")
    assert "| Asia | Pacific |" in run("run", "sales", "--config", str(path), "-f", "markdown")[1]
    out = run("run", "sales", "--config", str(path), "-f", "markdown", "--option", "escape=true")[1]
    assert "| Asia \\| Pacific |" in out


def test_output_file(write_config, tmp_path):
    path = write_config()
    target = tmp_path / "out" / "result.txt"
    target.parent.mkdir()
    code, out, _ = run("run", "sales", "--config", str(path), "--output", str(target))
    assert (code, out) == (0, "")
    assert target.read_text(encoding="utf-8") == TEXT


def test_output_from_the_config_file(write_config, tmp_path):
    target = tmp_path / "from-config.txt"
    path = write_config(f'output = "{target}"\n')
    run("run", "sales", "--config", str(path))
    assert target.read_text(encoding="utf-8") == TEXT


def test_formats_lists_what_is_registered(write_config):
    code, out, _ = run("formats", "--config", str(write_config()))
    assert code == 0
    assert out.splitlines() == [
        "markdown  .md    GitHub-flavoured Markdown table",
        "text      .txt   aligned plain-text table",
    ]


def test_reports_lists_the_definitions(write_config):
    assert run("reports", "--config", str(write_config()))[1] == "sales  (5 columns)\n"


def test_an_unknown_format_is_a_usage_error_before_anything_is_written(write_config, tmp_path):
    path = write_config()
    target = tmp_path / "never.txt"
    code, out, err = run("run", "sales", "--config", str(path), "--format", "nope", "--output", str(target))
    assert code == 2 and out == ""
    assert "reportly: error: unknown format 'nope' (available: markdown, text)" in err
    assert not target.exists()


def test_an_unknown_report_and_a_bad_option(write_config):
    path = write_config()
    code, _, err = run("run", "nope", "--config", str(path))
    assert code == 2 and "unknown report 'nope' (defined: sales)" in err
    code, _, err = run("run", "sales", "--config", str(path), "--option", "escape")
    assert code == 2 and "NAME=VALUE" in err
    code, _, err = run("run", "sales", "--config", str(path), "-f", "text", "--option", "colour=red")
    assert code == 2 and "no option 'colour'" in err


def test_data_errors_exit_with_1(write_config, sales_jsonl):
    sales_jsonl.write_text("{not json}\n", encoding="utf-8")
    code, _, err = run("run", "sales", "--config", str(write_config()))
    assert code == 1 and "sales.jsonl:1: not valid JSON" in err


def test_stats_go_to_stderr(write_config):
    _, out, err = run("run", "sales", "--config", str(write_config()), "--stats")
    assert out == TEXT
    assert err.startswith("3 rows in ")


def test_argparse_errors_are_exit_2():
    assert run("run")[0] == 2
    assert run("explode")[0] == 2
