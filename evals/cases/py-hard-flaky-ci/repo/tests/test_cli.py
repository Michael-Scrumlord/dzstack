import io

from schedkit.cli import main
from tests.helpers import at


def run(*argv):
    out = io.StringIO()
    code = main(list(argv), out)
    return code, out.getvalue()


def test_next_prints_utc_and_local_times():
    start = at(2025, 3, 10, 8).isoformat()
    code, out = run("next", "daily 09:00", "-n", "2", "--from", start)
    assert code == 0
    lines = out.splitlines()
    assert len(lines) == 2
    assert lines[0].endswith("local 2025-03-10 09:00") and lines[1].endswith("local 2025-03-11 09:00")


def test_bad_rules_are_exit_2(capsys):
    assert run("next", "sometimes")[0] == 2
    assert "schedkit:" in capsys.readouterr().err
