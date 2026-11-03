"""Hidden checks for the CSV export. Every expectation comes from docs/plugins.md ("Spreadsheet formats", "Streaming",
"Registering a format"), docs/config.md and docs/cli.md."""
import io
import re
import subprocess
import sys
from datetime import date, datetime
from decimal import Decimal
from pathlib import Path

import pytest

from reportly.cli import main
from reportly.columns import Column
from reportly.errors import ConfigError, RowError
from reportly.plugins import BUFFER_ROWS, FormatBase, available_formats, get_format, register_format, unregister
from reportly.reports import Report
from reportly.runner import run_report
from reportly.sources import MemorySource

BOM = "﻿"
DATA = [
    {"region": "Europe", "amount": "1234.50", "units": 12, "closed": "2025-03-09", "ok": True, "note": "first, with comma"},
    {"region": 'Asia "Pacific"', "amount": -20, "units": 3, "closed": "2025-03-30", "ok": False, "note": "two\nlines"},
    {"region": '=HYPERLINK("http://x")', "amount": 0.5, "units": -1500, "closed": None, "ok": None, "note": "+49 30 1234"},
    {"region": "@home", "amount": 7, "units": 0, "closed": "2025-12-31", "ok": True, "note": "-"},
]
COLUMNS_TOML = """
[reports.sales]
source = "jsonl"
path = "data.jsonl"
columns = [
  { key = "region", title = "Region" },
  { key = "amount", title = "Amount", kind = "decimal" },
  { key = "units", title = "Units", kind = "int" },
  { key = "closed", title = "Closed", kind = "date" },
  { key = "ok", title = "OK", kind = "bool" },
  { key = "note", title = "Note" },
]
"""
EXPECTED_CSV = (
    BOM
    + "Region,Amount,Units,Closed,OK,Note\r\n"
    + 'Europe,1234.50,12,2025-03-09,true,"first, with comma"\r\n'
    + '"Asia ""Pacific""",-20,3,2025-03-30,false,"two\nlines"\r\n'
    + '"\'=HYPERLINK(""http://x"")",0.5,-1500,,,\'+49 30 1234\r\n'
    + "'@home,7,0,2025-12-31,true,'-\r\n"
)


def project(tmp_path, head=""):
    import json

    (tmp_path / "data.jsonl").write_text("\n".join(json.dumps(r) for r in DATA) + "\n", encoding="utf-8")
    config = tmp_path / "reportly.toml"
    config.write_text(head + "\n" + COLUMNS_TOML, encoding="utf-8")
    return config


def run(*argv, env=None, cwd=None):
    out, err = io.StringIO(), io.StringIO()
    code = main(list(argv), stdout=out, stderr=err, env=env if env is not None else {}, cwd=cwd or Path("/nonexistent"))
    return code, out.getvalue(), err.getvalue()


def render(rows, titles=("A",), kinds=None, **options):
    columns = [Column(f"c{i}", t, (kinds or ["text"] * len(titles))[i]) for i, t in enumerate(titles)]
    out = io.StringIO()
    get_format("csv")(**options).render(columns, rows, out)
    return out.getvalue()


def bare(rows, titles=("A",), **options):
    """No byte order mark, no header: just the rows."""
    return render(rows, titles, bom=False, header=False, **options)


class TestRegistration:
    def test_the_registry_knows_csv(self):
        cls = get_format("csv")
        assert issubclass(cls, FormatBase)
        assert cls.name == "csv" and cls.extension == ".csv"
        assert cls.content_type.startswith("text/csv")
        assert cls.description and cls.description == cls.description.strip()
        assert "csv" in [f.name for f in available_formats()]

    def test_it_is_found_in_a_fresh_interpreter_without_importing_anything_by_hand(self):
        code = "from reportly.plugins import get_format; print(get_format('csv').extension)"
        result = subprocess.run([sys.executable, "-c", code], capture_output=True, text=True, check=True)
        assert result.stdout.strip() == ".csv"

    def test_the_runner_finds_it_without_the_cli(self):
        columns = [Column("a", "A"), Column("b", "B", "int")]
        out = io.StringIO()
        count = run_report(Report("r", MemorySource(columns, [("x", 1), ("y", 2)]), {}, None), "csv", out)
        assert count == 2
        assert out.getvalue() == BOM + "A,B\r\nx,1\r\ny,2\r\n"

    def test_the_formats_command_lists_it_and_leaves_the_others_alone(self):
        code, out, _ = run("formats")
        assert code == 0
        lines = out.splitlines()
        assert "markdown  .md    GitHub-flavoured Markdown table" in lines
        assert "text      .txt   aligned plain-text table" in lines
        csv_lines = [l for l in lines if l.startswith("csv")]
        assert len(csv_lines) == 1 and re.match(r"csv\s+\.csv\s+\S", csv_lines[0])
        assert len(lines) == 3

    def test_a_throwaway_format_registered_the_documented_way_works_everywhere(self, tmp_path):
        @register_format
        class Dummy(FormatBase):
            name = "dummy"
            extension = ".dmy"
            content_type = "text/plain"
            description = "test format"
            streaming = True

            def render(self, columns, rows, out):
                out.write("dummy:" + ",".join(c.title for c in columns) + f":{sum(1 for _ in rows)}\n")

        try:
            config = project(tmp_path)
            assert run("run", "sales", "--config", str(config), "--format", "dummy")[1].startswith("dummy:Region,Amount")
            assert run("run", "sales", "--config", str(config), env={"REPORTLY_FORMAT": "dummy"})[1].endswith(":4\n")
            code, _, err = run("run", "sales", "--config", str(config), "--format", "nope")
            assert code == 2 and "csv" in err and "dummy" in err  # the error lists the registry's names
        finally:
            unregister("dummy")


class TestSelection:
    def test_format_flag(self, tmp_path):
        config = project(tmp_path)
        assert run("run", "sales", "--config", str(config), "--format", "csv") == (0, EXPECTED_CSV, "")
        assert run("run", "sales", "--config", str(config), "-f", "csv")[1] == EXPECTED_CSV

    def test_config_file(self, tmp_path):
        config = project(tmp_path, 'format = "csv"')
        assert run("run", "sales", "--config", str(config)) == (0, EXPECTED_CSV, "")

    def test_the_config_file_is_found_in_the_working_folder(self, tmp_path):
        project(tmp_path, 'format = "csv"')
        assert run("run", "sales", cwd=tmp_path)[1] == EXPECTED_CSV

    def test_environment_and_flag_win_over_the_config_file(self, tmp_path):
        config = project(tmp_path, 'format = "csv"')
        assert run("run", "sales", "--config", str(config), env={"REPORTLY_FORMAT": "markdown"})[1].startswith("| Region |")
        assert run("run", "sales", "--config", str(config), "--format", "text")[1].startswith("Region  ")
        config = project(tmp_path, 'format = "text"')
        assert run("run", "sales", "--config", str(config), env={"REPORTLY_FORMAT": "csv"})[1] == EXPECTED_CSV

    def test_output_file_bytes(self, tmp_path):
        config = project(tmp_path, 'format = "csv"')
        target = tmp_path / "out.csv"
        assert run("run", "sales", "--config", str(config), "--output", str(target))[:2] == (0, "")
        raw = target.read_bytes()
        assert raw.startswith(b"\xef\xbb\xbfRegion,Amount")
        assert raw == EXPECTED_CSV.encode("utf-8")
        assert raw.count(b"\r\n") == 5  # the header and four rows; the line break inside a cell stays a bare LF
        assert b"\r\r" not in raw and raw.endswith(b"\r\n")

    def test_options_from_the_config_file(self, tmp_path):
        config = project(tmp_path, 'format = "csv"\n[formats.csv]\ndelimiter = ";"\nbom = false\nheader = false')
        _, out, _ = run("run", "sales", "--config", str(config))
        assert out == (
            "Europe;1234.50;12;2025-03-09;true;first, with comma\r\n"
            '"Asia ""Pacific""";-20;3;2025-03-30;false;"two\nlines"\r\n'
            '"\'=HYPERLINK(""http://x"")";0.5;-1500;;;\'+49 30 1234\r\n'
            "'@home;7;0;2025-12-31;true;'-\r\n"
        )

    def test_options_from_the_command_line(self, tmp_path):
        config = project(tmp_path, 'format = "csv"\n[formats.csv]\ndelimiter = ";"')
        _, out, _ = run("run", "sales", "--config", str(config), "--option", "delimiter=|", "--option", "bom=false", "--option", "header=no")
        assert out.startswith("Europe|1234.50|12|2025-03-09|true|first, with comma\r\n")

    def test_bad_options_are_usage_errors_that_name_the_option(self, tmp_path):
        config = project(tmp_path, 'format = "csv"')
        for bad in ("delimiter=ab", "delimiter=", 'delimiter="', "bom=maybe", "colour=red"):
            code, out, err = run("run", "sales", "--config", str(config), "--option", bad)
            assert code == 2 and out == "", bad
            assert err.startswith("reportly: error:") and bad.split("=")[0] in err, (bad, err)
        config = project(tmp_path, 'format = "csv"\n[formats.csv]\ndelimiter = "ab"')
        code, out, err = run("run", "sales", "--config", str(config))
        assert code == 2 and out == "" and "delimiter" in err
        config = project(tmp_path, 'format = "csv"\n[formats.csv]\nquote = "x"')
        code, out, err = run("run", "sales", "--config", str(config))
        assert code == 2 and out == "" and "quote" in err

    def test_a_malformed_row_is_reported_with_its_number(self):
        with pytest.raises(RowError) as caught:
            render([("a", "b"), ("c", "d"), ("only one",)], titles=("A", "B"))
        assert (caught.value.row_number, caught.value.expected, caught.value.got) == (3, 2, 1)
        with pytest.raises(RowError) as caught:
            render([("a", "b", "extra")], titles=("A", "B"))
        assert caught.value.row_number == 1


class TestConventions:
    def test_header_is_the_titles_not_the_keys(self):
        assert render([], titles=("Region", "Total amount")) == BOM + "Region,Total amount\r\n"
        columns = [Column("r", "Region"), Column("t", "Total")]
        out = io.StringIO()
        get_format("csv")().render(columns, [("x", 1)], out)
        assert out.getvalue() == BOM + "Region,Total\r\nx,1\r\n"

    def test_byte_order_mark_and_header_can_be_switched_off(self):
        assert render([("x",)]) == BOM + "A\r\nx\r\n"
        assert render([("x",)], bom=False) == "A\r\nx\r\n"
        assert render([("x",)], header=False) == BOM + "x\r\n"
        assert render([("x",)], bom=False, header=False) == "x\r\n"
        assert render([], bom=False, header=False) == ""
        assert render([], bom=True, header=False) == BOM

    def test_every_row_ends_with_crlf_the_last_one_too(self):
        out = bare([("a",), ("b",), ("c",)])
        assert out == "a\r\nb\r\nc\r\n"

    @pytest.mark.parametrize(
        "value, written",
        [
            ("=SUM(A1:A9)", "'=SUM(A1:A9)"),
            ("+1", "'+1"),
            ("-1+2", "'-1+2"),
            ("@x", "'@x"),
            ("-", "'-"),
            ("=", "'="),
            ("\tx", "'\tx"),
            ("\rx", "\"'\rx\""),
            ("=a,b", "\"'=a,b\""),
            ('=cmd|"x"', "\"'=cmd|\"\"x\"\"\""),
            ("-5", "'-5"),  # text that looks like a number is still text
            (" =x", " =x"),
            ("x=1", "x=1"),
            ("a-b", "a-b"),
            ("−5", "−" + "5"),
            ("", ""),
            ("plain text", "plain text"),
        ],
    )
    def test_formula_guard_on_text(self, value, written):
        assert bare([(value,)]) == written + "\r\n"

    @pytest.mark.parametrize(
        "value, written",
        [
            (-12.5, "-12.5"),
            (-3, "-3"),
            (Decimal("-1.50"), "-1.50"),
            (float("-0.0"), "-0.0"),
            (Decimal("-0.001"), "-0.001"),
            (True, "true"),
            (False, "false"),
            (None, ""),
            (date(2025, 3, 9), "2025-03-09"),
            (datetime(2025, 3, 9, 1, 2, 3), "2025-03-09T01:02:03"),
            (1e-07, "1e-07"),
            (3.0, "3.0"),
            (Decimal("1E+3"), "1000"),
            (1234567, "1234567"),
            (Decimal("1234.50"), "1234.50"),
        ],
    )
    def test_numbers_and_other_values_are_written_exactly_and_never_guarded(self, value, written):
        assert bare([(value,)]) == written + "\r\n"

    @pytest.mark.parametrize(
        "value, written",
        [
            ("a,b", '"a,b"'),
            ('say "hi"', '"say ""hi"""'),
            ("line1\nline2", '"line1\nline2"'),
            ("a\r\nb", '"a\r\nb"'),
            ("a\rb", '"a\rb"'),
            ('"', '""""'),
            ("it's", "it's"),
            ("semi;colon", "semi;colon"),
            ("trailing space ", "trailing space "),
            ("café ☃", "café ☃"),
        ],
    )
    def test_quoting(self, value, written):
        assert bare([(value,)]) == written + "\r\n"

    def test_another_delimiter_changes_what_needs_quoting(self):
        assert bare([("a;b", "c,d", "e")], ("A", "B", "C"), delimiter=";") == '"a;b";c,d;e\r\n'
        assert bare([("a\tb", "\tx")], ("A", "B"), delimiter="\t") == "\"a\tb\"\t\"'\tx\"\r\n"
        assert render([("x", "y")], ("=A", "B"), delimiter="|") == BOM + "'=A|B\r\nx|y\r\n"

    def test_the_guard_applies_to_headers_too(self):
        assert render([], titles=("=Total", "+x", "@y", "ok")) == BOM + "'=Total,'+x,'@y,ok\r\n"
        assert render([], titles=("a,b",)) == BOM + '"a,b"\r\n'

    def test_a_value_in_a_numeric_column_that_is_text_is_still_guarded(self):
        assert bare([("-5",), (-5,)], kinds=["int"]) == "'-5\r\n-5\r\n"

    def test_unicode_survives(self):
        assert bare([("Zoë — 東京",)]) == "Zoë — 東京\r\n"


class Feed:
    """Rows produced on demand. Iterating it a second time is an error."""

    def __init__(self, n):
        self.n = n
        self.pulled = 0
        self.iterations = 0

    def __iter__(self):
        self.iterations += 1
        assert self.iterations == 1, "the rows were iterated more than once"
        return self._generate()

    def _generate(self):
        for i in range(self.n):
            self.pulled += 1
            yield (f"row {i}", i, -i)


class Recorder:
    def __init__(self, feed):
        self.feed = feed
        self.writes = []

    def write(self, text):
        self.writes.append((self.feed.pulled, text))
        return len(text)

    def flush(self):
        pass


COLUMNS3 = [Column("name", "Name"), Column("n", "N", "int"), Column("neg", "Neg", "int")]


def check_streamed(feed, recorder, n):
    assert feed.iterations == 1
    assert feed.pulled == n
    seen = 0
    for pulled, text in recorder.writes:
        found = [int(m) for m in re.findall(r"row (\d+)", text)]
        if not found:
            continue
        seen += len(found)
        assert pulled <= min(found) + 1 + BUFFER_ROWS, (
            f"{pulled} rows had been pulled from the feed when row {min(found)} was written: "
            f"a streaming format may hold at most {BUFFER_ROWS}"
        )
    assert seen == n
    joined = "".join(text for _, text in recorder.writes)
    assert joined.startswith(BOM + "Name,N,Neg\r\nrow 0,0,0\r\nrow 1,1,-1\r\n")
    assert joined.endswith(f"row {n - 1},{n - 1},{-(n - 1)}\r\n")


class TestStreaming:
    def test_the_format_declares_that_it_streams(self):
        assert get_format("csv").streaming is True

    def test_the_rows_are_pulled_once_and_never_collected(self):
        feed = Feed(5000)
        recorder = Recorder(feed)
        get_format("csv")().render(COLUMNS3, feed, recorder)
        check_streamed(feed, recorder, 5000)

    def test_through_the_runner(self):
        feed = Feed(5000)
        recorder = Recorder(feed)
        report = Report("r", MemorySource(COLUMNS3, feed), {}, None)
        assert run_report(report, "csv", recorder) == 5000
        check_streamed(feed, recorder, 5000)

    def test_an_empty_feed(self):
        feed = Feed(0)
        recorder = Recorder(feed)
        get_format("csv")().render(COLUMNS3, feed, recorder)
        assert "".join(t for _, t in recorder.writes) == BOM + "Name,N,Neg\r\n"

    def test_a_bad_row_deep_in_the_feed_stops_the_run_without_reading_everything(self):
        feed = Feed(1_000_000)

        def broken():
            for i, row in enumerate(feed):
                yield row if i < 300 else (row[0],)

        with pytest.raises(RowError) as caught:
            get_format("csv")().render(COLUMNS3, broken(), Recorder(feed))
        assert caught.value.row_number == 301
        assert feed.pulled <= 301 + BUFFER_ROWS


class TestExistingFormatsAreUnchanged:
    def test_text(self, tmp_path):
        config = project(tmp_path)
        assert run("run", "sales", "--config", str(config)) == (0, GOLDEN_TEXT, "")
        assert run("run", "sales", "--config", str(config), "-f", "text", "-O", "max_width=10")[1] == GOLDEN_TEXT_10

    def test_markdown(self, tmp_path):
        config = project(tmp_path)
        assert run("run", "sales", "--config", str(config), "-f", "markdown") == (0, GOLDEN_MARKDOWN, "")

    def test_values_helpers_are_untouched(self):
        from reportly.formatting import display, machine

        assert display(Decimal("-1234.5")) == "-1,234.50"
        assert display(None) == "-" and display(True) == "yes"
        assert machine(Decimal("-1234.5")) == "-1234.5"
        assert machine("=x") == "=x" and machine(-3) == "-3"


GOLDEN_TEXT = (
    'Region                    Amount   Units  Closed      OK   Note\n'
    '----------------------  --------  ------  ----------  ---  -----------------\n'
    'Europe                  1,234.50      12  2025-03-09  yes  first, with comma\n'
    'Asia "Pacific"            -20.00       3  2025-03-30  no   two lines\n'
    '=HYPERLINK("http://x")      0.50  -1,500  -           -    +49 30 1234\n'
    '@home                       7.00       0  2025-12-31  yes  -\n'
    '(4 rows)\n'
)
GOLDEN_TEXT_10 = (
    'Region        Amount   Units  Closed      OK   Note\n'
    '----------  --------  ------  ----------  ---  ----------\n'
    'Europe      1,234.50      12  2025-03-09  yes  first, ...\n'
    'Asia "P...    -20.00       3  2025-03-30  no   two lines\n'
    '=HYPERL...      0.50  -1,500  -           -    +49 30 ...\n'
    '@home           7.00       0  2025-12-31  yes  -\n'
    '(4 rows)\n'
)
GOLDEN_MARKDOWN = (
    '| Region | Amount | Units | Closed | OK | Note |\n'
    '| --- | ---: | ---: | --- | --- | --- |\n'
    '| Europe | 1,234.50 | 12 | 2025-03-09 | yes | first, with comma |\n'
    '| Asia "Pacific" | -20.00 | 3 | 2025-03-30 | no | two lines |\n'
    '| =HYPERLINK("http://x") | 0.50 | -1,500 | - | - | +49 30 1234 |\n'
    '| @home | 7.00 | 0 | 2025-12-31 | yes | - |\n'
)
