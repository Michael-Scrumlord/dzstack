import io
import json

from billing.cli import main


def run(argv):
    out, err = io.StringIO(), io.StringIO()
    code = main(argv, stdout=out, stderr=err)
    return code, out.getvalue(), err.getvalue()


def write(tmp_path, doc, name="invoice.json"):
    path = tmp_path / name
    path.write_text(json.dumps(doc))
    return str(path)


def test_compute_and_render(tmp_path, doc):
    path = write(tmp_path, doc)
    code, out, _ = run(["compute", path])
    assert code == 0 and json.loads(out)["total_cents"] == 9844
    code, out, _ = run(["render", path])
    assert code == 0 and out.startswith("INVOICE (draft)")
    code, out, _ = run(["render", path, "--format", "html"])
    assert code == 0 and out.startswith('<article class="invoice">')


def test_issue_show_export(tmp_path, doc):
    store = str(tmp_path / "store")
    path = write(tmp_path, doc)
    assert run(["issue", path, "--store", store]) == (0, "2026-0001\n", "")
    code, out, _ = run(["show", "2026-0001", "--store", store])
    assert code == 0 and "TOTAL" in out
    code, out, _ = run(["export", "--store", store])
    assert code == 0 and out.splitlines()[1].startswith("2026-0001,2026-03-02,Acme GmbH,USD,86.50,11.94,98.44")


def test_errors_exit_with_status_2(tmp_path, doc):
    doc["lines"] = []
    code, out, err = run(["compute", write(tmp_path, doc)])
    assert (code, out) == (2, "") and err == "error: lines must be a non-empty list\n"
    code, _, err = run(["compute", str(tmp_path / "missing.json")])
    assert code == 2 and err.startswith("error: cannot read")
    (tmp_path / "bad.json").write_text("{")
    code, _, err = run(["compute", str(tmp_path / "bad.json")])
    assert code == 2 and "not valid JSON" in err
    code, _, err = run(["show", "2026-0099", "--store", str(tmp_path)])
    assert code == 2 and err == "error: no invoice 2026-0099\n"


def test_plan_and_remind(tmp_path, doc):
    code, out, _ = run(["plan", "1000", "3", "--first-due", "2026-04-01"])
    assert code == 0 and [r["amount_cents"] for r in json.loads(out)] == [334, 333, 333]
    store = str(tmp_path / "store")
    run(["issue", write(tmp_path, doc), "--store", store])
    code, out, _ = run(["remind", "--store", store, "--today", "2026-05-01"])
    assert code == 0 and out.startswith("Dear Acme GmbH, invoice 2026-0001 for $98.44")
    code, _, err = run(["remind", "--store", store, "--today", "tomorrow"])
    assert code == 2 and "--today" in err
