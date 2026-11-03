from staffdir import cli


def run(capsys, db_path, *argv):
    code = cli.main(["--db", str(db_path), *argv])
    out = capsys.readouterr()
    return code, out.out, out.err


def test_migrate_then_add_list_show(capsys, tmp_path):
    db_path = tmp_path / "dir.db"
    code, out, _ = run(capsys, db_path, "migrate")
    assert code == 0 and out.startswith("applied: 0001")
    assert run(capsys, db_path, "migrate")[1] == "applied: nothing to do\n"

    code, out, _ = run(capsys, db_path, "users", "add", "--name", "Ada Lovelace", "--email", "ada@example.com")
    assert code == 0 and "Ada Lovelace  <ada@example.com>" in out
    run(capsys, db_path, "users", "add", "--name", "Grace Hopper", "--email", "grace@example.com")

    _, out, _ = run(capsys, db_path, "users", "list")
    assert out.splitlines() == ["   1  Ada Lovelace  <ada@example.com>", "   2  Grace Hopper  <grace@example.com>"]
    _, out, _ = run(capsys, db_path, "users", "list", "--q", "hop")
    assert out.splitlines() == ["   2  Grace Hopper  <grace@example.com>"]
    _, out, _ = run(capsys, db_path, "users", "show", "1")
    assert "status active" in out


def test_errors_exit_non_zero(capsys, tmp_path):
    db_path = tmp_path / "dir.db"
    run(capsys, db_path, "migrate")
    code, _, err = run(capsys, db_path, "users", "show", "9")
    assert code == 1 and "no user 9" in err
    code, _, err = run(capsys, db_path, "users", "add", "--name", "  ", "--email", "a.b@example.org")
    assert code == 2 and "full_name is required" in err


def test_export_and_index(capsys, tmp_path):
    db_path = tmp_path / "dir.db"
    run(capsys, db_path, "migrate")
    run(capsys, db_path, "users", "add", "--name", "Ada Lovelace", "--email", "ada@example.com")
    _, out, _ = run(capsys, db_path, "export", "users")
    assert out.splitlines() == ["id,full_name,email,team,status", "1,Ada Lovelace,ada@example.com,,active"]
    _, out, _ = run(capsys, db_path, "report", "index")
    assert out == "L  Ada Lovelace\n"
