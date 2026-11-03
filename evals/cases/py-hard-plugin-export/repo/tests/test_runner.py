import io
import types

import pytest

from reportly.errors import PluginError, ReportlyError
from reportly.plugins import FormatBase, register_format, unregister
from reportly.reports import Report
from reportly.runner import open_output, run_report
from reportly.sources import MemorySource


@pytest.fixture
def probe():
    """A format that records what the runner hands it."""
    seen = types.SimpleNamespace(rows=None)

    def make(streaming):
        class Probe(FormatBase):
            name = "probe"
            extension = ".prb"
            content_type = "text/plain"
            description = "records its input"

            def render(self, columns, rows, out):
                seen.rows = rows
                out.write(",".join(str(r[0]) for r in rows))

        Probe.streaming = streaming
        register_format(Probe)
        return seen

    yield make
    unregister("probe")


def report(columns, rows):
    return Report("r", MemorySource(columns[:1], ((r[0],) for r in rows)), {}, None)


def test_streaming_formats_get_a_lazy_iterator(probe, columns, rows):
    seen = probe(True)
    out = io.StringIO()
    assert run_report(report(columns, rows), "probe", out) == 3
    assert out.getvalue() == "Europe,Asia | Pacific,Americas"
    assert not isinstance(seen.rows, (list, tuple))
    assert iter(seen.rows) is seen.rows


def test_other_formats_get_a_list(probe, columns, rows):
    seen = probe(False)
    assert run_report(report(columns, rows), "probe", io.StringIO()) == 3
    assert isinstance(seen.rows, list)


def test_unknown_formats_are_plugin_errors(columns, rows):
    with pytest.raises(PluginError, match="unknown format"):
        run_report(report(columns, rows), "nope", io.StringIO())


def test_options_reach_the_format(columns, rows):
    out = io.StringIO()
    run_report(Report("r", MemorySource(columns, rows), {}, None), "markdown", out, {"escape": "false"})
    assert "| Asia | Pacific |" in out.getvalue()


def test_open_output_writes_utf8_without_newline_translation(tmp_path):
    target = tmp_path / "x.txt"
    with open_output(str(target)) as out:
        out.write("café\r\nline\n")
    assert target.read_bytes() == "café\r\nline\n".encode("utf-8")


def test_open_output_without_a_path_is_stdout():
    stream = io.StringIO()
    with open_output(None, stream) as out:
        assert out is stream


def test_open_output_reports_unwritable_paths(tmp_path):
    with pytest.raises(ReportlyError, match="cannot write"):
        with open_output(str(tmp_path / "missing" / "x.txt")):
            pass
