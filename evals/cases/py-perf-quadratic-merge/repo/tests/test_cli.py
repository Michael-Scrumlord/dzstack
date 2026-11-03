import json

from recsync.cli import main
from recsync.jsonl import read_jsonl, write_jsonl


def test_jsonl_round_trip(tmp_path):
    path = str(tmp_path / "x.jsonl")
    assert write_jsonl(path, [{"id": 1, "name": "Zoë"}, {"id": 2}]) == 2
    assert list(read_jsonl(path)) == [{"id": 1, "name": "Zoë"}, {"id": 2}]


def test_blank_lines_are_skipped_and_bad_lines_reported(tmp_path):
    path = tmp_path / "x.jsonl"
    path.write_text('{"id": 1}\n\n{"id": 2}\n', encoding="utf-8")
    assert len(list(read_jsonl(str(path)))) == 2
    path.write_text('{"id": 1}\nnot json\n', encoding="utf-8")
    try:
        list(read_jsonl(str(path)))
    except ValueError as exc:
        assert "line 2" in str(exc)
    else:
        raise AssertionError("expected ValueError")


def test_merges_two_files(tmp_path, capsys):
    base, incoming, out = (str(tmp_path / n) for n in ("base.jsonl", "incoming.jsonl", "out.jsonl"))
    write_jsonl(base, [{"id": "a", "updated_at": "2026-01-01T00:00:00Z", "plan": "free"}])
    write_jsonl(incoming, [{"id": "a", "updated_at": "2026-01-02T00:00:00Z", "plan": "pro"}, {"id": "b"}])
    assert main([base, incoming, "-o", out]) == 0
    assert "2 records written" in capsys.readouterr().out
    assert [r["plan"] for r in read_jsonl(out) if "plan" in r] == ["pro"]
    assert [r["id"] for r in read_jsonl(out)] == ["a", "b"]


def test_missing_input_is_an_error(tmp_path, capsys):
    assert main([str(tmp_path / "none.jsonl"), str(tmp_path / "none2.jsonl"), "-o", str(tmp_path / "o")]) == 2
    assert capsys.readouterr().err.startswith("recsync:")
